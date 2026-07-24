/**
 * approveAndSend — the single sanctioned path from an approved draft to Lemlist.
 *
 * Nothing else in this codebase is permitted to dispatch a reply to a lead.
 * `lemlist.sendReply()` requires a capability token that only this module can
 * mint (see sendAuthorization.ts), so the restriction is mechanical, not a
 * convention: any other caller fails to typecheck and throws at runtime.
 *
 * Order of operations, deliberately:
 *   1. APPROVAL_REQUIRED fuse
 *   2. approver context is a verified Slack/Telegram interaction
 *   3. load the draft and hard-check the PERSISTED approval flag
 *   4. verify approval provenance (a legitimate surface, a named human)
 *   5. claim an idempotency row — atomic, DB-enforced, before any network call
 *   6. only then contact Lemlist
 */

import { eq } from "drizzle-orm";
import { db, draftsTable, replySendsTable } from "@workspace/db";
import { sendReply } from "./lemlist";
import { logger } from "./logger";
import {
  ApprovalRequiredError,
  assertApprovalRequired,
  assertLegitimateApprover,
  type ApproverContext,
} from "./approvalGate";
import { claimSendAuthorizationMinter } from "./sendAuthorization";

// Claim exclusive minting rights at import time. If any other module ever tries
// to claim them the process fails at startup instead of quietly gaining the
// ability to send without approval.
const mintSendAuthorization = claimSendAuthorizationMinter("approveAndSend");

export type ApproveAndSendOutcome =
  | { status: "sent"; draftId: number }
  | { status: "already_sent"; draftId: number }
  | { status: "not_found"; draftId: number }
  | { status: "send_failed"; draftId: number; error: string };

/** Idempotency key for the outbound send — one dispatch per draft, forever. */
export function buildSendKey(draftId: number): string {
  return `draft:${draftId}`;
}

/**
 * Claim the right to send this draft.
 *
 * Returns true when this call owns the send. Returns false when another
 * attempt already owns it — in which case we must NOT contact Lemlist.
 * The uniqueness is enforced by the `reply_sends_send_key_uidx` constraint, so
 * two concurrent Slack clicks race in Postgres rather than in Node.
 */
async function claimSend(draftId: number, ctx: ApproverContext): Promise<boolean> {
  const claimed = await db
    .insert(replySendsTable)
    .values({
      sendKey: buildSendKey(draftId),
      draftId,
      approvedBy: ctx.userId,
      approvalSource: ctx.source,
    })
    .onConflictDoNothing({ target: replySendsTable.sendKey })
    .returning({ id: replySendsTable.id });

  return Array.isArray(claimed) && claimed.length > 0;
}

/** Release a claim after a failed dispatch so an operator can retry from Slack. */
async function releaseSendClaim(draftId: number): Promise<void> {
  try {
    await db.delete(replySendsTable).where(eq(replySendsTable.sendKey, buildSendKey(draftId)));
  } catch (err) {
    logger.warn({ err, draftId }, "approveAndSend: failed to release send claim — retry will be blocked");
  }
}

async function markSendCompleted(draftId: number): Promise<void> {
  try {
    await db
      .update(replySendsTable)
      .set({ completedAt: new Date() })
      .where(eq(replySendsTable.sendKey, buildSendKey(draftId)));
  } catch (err) {
    logger.warn({ err, draftId }, "approveAndSend: failed to stamp send completion");
  }
}

/**
 * Dispatch an approved reply to Lemlist.
 *
 * Throws ApprovalRequiredError if the draft is not approved — it never falls
 * back to sending. Returns an outcome for every other case so the caller can
 * update Slack and the activity feed.
 */
export async function approveAndSend(
  draftId: number,
  approverContext: ApproverContext,
  options?: {
    /** Text to send. Defaults to the draft's edited text, then its AI text. */
    replyText?: string;
    /** Lemlist campaign id — resolved by the caller, which already loaded it. */
    lemlistCampaignId?: string;
  },
): Promise<ApproveAndSendOutcome> {
  // ── 1. Runtime fuse ───────────────────────────────────────────────────────
  assertApprovalRequired();

  // ── 2. The approval must come from a verified interactive surface ─────────
  assertLegitimateApprover(approverContext);

  // ── 3. Hard approval check against PERSISTED state ────────────────────────
  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, draftId));
  if (!draft) {
    logger.warn({ draftId }, "approveAndSend: draft not found");
    return { status: "not_found", draftId };
  }

  if (!draft.approved) {
    logger.error(
      { draftId, status: draft.status, source: approverContext.source },
      "approveAndSend: BLOCKED — draft is not approved",
    );
    throw new ApprovalRequiredError("Reply requires approval");
  }

  // ── 4. The recorded approval must itself be legitimate ────────────────────
  // Guards against an `approved` flag written by anything other than the
  // approval gate (a migration, a manual UPDATE, a stray code path).
  if (draft.approvalSource !== "slack" && draft.approvalSource !== "telegram") {
    logger.error(
      { draftId, approvalSource: draft.approvalSource },
      "approveAndSend: BLOCKED — approval has no legitimate source",
    );
    throw new ApprovalRequiredError(
      "Reply requires approval — recorded approval did not come from Slack or Telegram",
    );
  }
  if (!draft.approvedBy || !draft.approvedBy.trim()) {
    logger.error({ draftId }, "approveAndSend: BLOCKED — approval has no named approver");
    throw new ApprovalRequiredError("Reply requires approval — recorded approval names no approver");
  }

  // Terminal states are never re-sent.
  if (draft.status === "sent" || draft.status === "edited" || draft.status === "discarded") {
    logger.info({ draftId, status: draft.status }, "approveAndSend: draft already actioned — not sending");
    return { status: "already_sent", draftId };
  }

  const replyText = options?.replyText ?? draft.editedReplyText ?? draft.replyText;
  const campaignId = options?.lemlistCampaignId;
  if (!campaignId) {
    return { status: "send_failed", draftId, error: "Campaign not found" };
  }

  // ── 5. Atomic idempotency claim — before any network call ─────────────────
  const owns = await claimSend(draftId, approverContext);
  if (!owns) {
    logger.warn(
      { draftId },
      "approveAndSend: send already claimed for this draft — skipping duplicate dispatch",
    );
    return { status: "already_sent", draftId };
  }

  // ── 6. Dispatch ───────────────────────────────────────────────────────────
  const authorization = mintSendAuthorization({
    draftId,
    approvalSource: draft.approvalSource,
    approvedBy: draft.approvedBy,
  });

  let error: string | undefined;
  try {
    const result = await sendReply(
      { leadId: draft.prospectEmail, campaignId, replyText, draftId },
      authorization,
    );
    if (!result.ok) error = result.error ?? "unknown Lemlist error";
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (error) {
    logger.error({ draftId, error }, "approveAndSend: Lemlist dispatch failed");
    await releaseSendClaim(draftId);
    return { status: "send_failed", draftId, error };
  }

  await markSendCompleted(draftId);
  logger.info(
    { draftId, approvedBy: draft.approvedBy, approvalSource: draft.approvalSource },
    "approveAndSend: reply dispatched",
  );
  return { status: "sent", draftId };
}
