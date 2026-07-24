/**
 * Inbound-reply idempotency.
 *
 * Lemlist (and any n8n hop in front of it) will re-deliver a webhook on
 * timeout, on retry, and occasionally for no reason at all. Without a claim,
 * every redelivery produced a fresh draft, a fresh Claude call and a fresh
 * Slack approval card for the same lead reply.
 *
 * The claim is `INSERT ... ON CONFLICT DO NOTHING RETURNING id` against a
 * UNIQUE index, so concurrent deliveries are resolved by Postgres rather than
 * by a read-then-write check that can interleave.
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, inboundRepliesTable } from "@workspace/db";
import { logger } from "./logger";
import type { LemlistWebhookPayload } from "./lemlist";

/**
 * Build a stable key for one inbound reply event.
 *
 * Prefers identifiers Lemlist supplies (message id, then lead id, then lead
 * email) and falls back to a hash of the reply body so that even a payload with
 * no ids at all cannot be processed twice.
 */
export function buildInboundIdempotencyKey(payload: LemlistWebhookPayload): string {
  const campaignId = String(payload.campaignId ?? "unknown");

  const messageId =
    (typeof payload.messageId === "string" && payload.messageId) ||
    (typeof payload.emailId === "string" && payload.emailId) ||
    (typeof payload._id === "string" && payload._id) ||
    undefined;

  const lead = payload.leadId ?? payload.leadEmail ?? "unknown-lead";

  if (messageId) return `${campaignId}:${lead}:${messageId}`;

  const body = payload.replyText ?? payload.text ?? "";
  const bodyHash = createHash("sha256").update(body).digest("hex").slice(0, 32);
  return `${campaignId}:${lead}:${payload.type ?? "reply"}:${bodyHash}`;
}

export interface InboundClaim {
  /** True when this process owns the event and must handle it. */
  claimed: boolean;
  idempotencyKey: string;
  claimId?: number;
}

/**
 * Attempt to claim an inbound reply. Returns `claimed: false` when the event
 * has already been recorded — in which case the caller must do nothing.
 */
export async function claimInboundReply(payload: LemlistWebhookPayload): Promise<InboundClaim> {
  const idempotencyKey = buildInboundIdempotencyKey(payload);

  const inserted = await db
    .insert(inboundRepliesTable)
    .values({
      idempotencyKey,
      campaignId: String(payload.campaignId ?? ""),
      leadId: payload.leadId ?? null,
      leadEmail: payload.leadEmail ?? null,
    })
    .onConflictDoNothing({ target: inboundRepliesTable.idempotencyKey })
    .returning({ id: inboundRepliesTable.id });

  if (!Array.isArray(inserted) || inserted.length === 0) {
    logger.warn(
      { idempotencyKey, campaignId: payload.campaignId },
      "claimInboundReply: duplicate Lemlist delivery — already processed, ignoring",
    );
    return { claimed: false, idempotencyKey };
  }

  return { claimed: true, idempotencyKey, claimId: inserted[0]?.id };
}

/** Attach the produced draft to the claim, for traceability. */
export async function linkClaimToDraft(idempotencyKey: string, draftId: number): Promise<void> {
  try {
    await db
      .update(inboundRepliesTable)
      .set({ draftId })
      .where(eq(inboundRepliesTable.idempotencyKey, idempotencyKey));
  } catch (err) {
    logger.warn({ err, idempotencyKey, draftId }, "linkClaimToDraft failed — claim left unlinked");
  }
}

/**
 * Release a claim. Used when processing failed before a draft existed, so a
 * genuine Lemlist retry can still be handled.
 */
export async function releaseInboundClaim(idempotencyKey: string): Promise<void> {
  try {
    await db.delete(inboundRepliesTable).where(eq(inboundRepliesTable.idempotencyKey, idempotencyKey));
  } catch (err) {
    logger.warn({ err, idempotencyKey }, "releaseInboundClaim failed — retries for this reply will be ignored");
  }
}
