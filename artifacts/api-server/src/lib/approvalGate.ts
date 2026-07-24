/**
 * Approval gate — the only place a draft's `approved` flag may be set.
 *
 * Rules enforced here:
 *   1. An approval may only originate from a *verified* interactive request on
 *      Slack or Telegram. `signatureVerified` must already be true; this module
 *      never verifies it itself, it refuses anything that has not been verified
 *      upstream (Slack request signing in lib/slack.ts).
 *   2. No timer, cron, sweeper, queue worker or REST route may approve. There is
 *      no code path here that takes an approval source other than the two above.
 *   3. Approval is recorded atomically and only from a non-terminal status, so a
 *      draft that was already sent/discarded cannot be retroactively approved.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db, draftsTable } from "@workspace/db";
import { logger } from "./logger";
import type { ApprovalSource } from "./sendAuthorization";

/** Statuses from which an operator may still approve a reply. */
export const APPROVABLE_STATUSES = ["pending", "send_failed"] as const;

export interface ApproverContext {
  /** Interactive surface the approval arrived on. */
  source: ApprovalSource;
  /** Slack/Telegram user id of the human who clicked Approve. */
  userId: string;
  /** Slack team / Telegram chat id, for the audit trail. */
  teamId?: string;
  /**
   * True only when the inbound request's signature was cryptographically
   * verified (Slack signing secret / Telegram secret token). The gate refuses
   * anything else — a forged or replayed payload cannot approve a reply.
   */
  signatureVerified: boolean;
  /** Slack action_id / callback_id or Telegram update id — recorded for audit. */
  interactionRef?: string;
}

export class ApprovalRequiredError extends Error {
  constructor(message = "Reply requires approval") {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}

/**
 * Runtime fuse. With APPROVAL_REQUIRED unset or "true" (the production default)
 * the approval gate is mandatory. It can only be relaxed by explicitly setting
 * APPROVAL_REQUIRED=false, and never in production: NODE_ENV=production ignores
 * the opt-out entirely.
 */
export function isApprovalRequired(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.APPROVAL_REQUIRED !== "false";
}

/** Throws unless the approval gate is active. Called at the top of approveAndSend(). */
export function assertApprovalRequired(): void {
  if (!isApprovalRequired()) {
    logger.error(
      { nodeEnv: process.env.NODE_ENV },
      "APPROVAL_REQUIRED is disabled — refusing to send anyway. This flag is not a send switch.",
    );
    throw new ApprovalRequiredError(
      "Reply requires approval — APPROVAL_REQUIRED must be enabled to dispatch replies",
    );
  }
}

/** Throws unless the context describes a verified human action on a legitimate surface. */
export function assertLegitimateApprover(ctx: ApproverContext): void {
  if (ctx.source !== "slack" && ctx.source !== "telegram") {
    throw new ApprovalRequiredError(
      `Reply requires approval — "${String(ctx.source)}" is not an approval surface`,
    );
  }
  if (ctx.signatureVerified !== true) {
    throw new ApprovalRequiredError(
      "Reply requires approval — approval request signature was not verified",
    );
  }
  if (!ctx.userId || !ctx.userId.trim() || ctx.userId === "unknown") {
    throw new ApprovalRequiredError("Reply requires approval — approver identity is unknown");
  }
}

export interface RecordApprovalResult {
  approved: boolean;
  /** Set when the draft could not be approved — e.g. already actioned. */
  reason?: string;
}

/**
 * Record a human approval for a draft.
 *
 * This is the ONLY writer of drafts.approved / approvedBy / approvedAt /
 * approvalSource. It is called from the Slack (and, when added, Telegram)
 * interaction handler and from nowhere else.
 */
export async function recordApproval(
  draftId: number,
  ctx: ApproverContext,
): Promise<RecordApprovalResult> {
  assertApprovalRequired();
  assertLegitimateApprover(ctx);

  const updated = await db
    .update(draftsTable)
    .set({
      approved: true,
      approvedBy: ctx.userId,
      approvedAt: new Date(),
      approvalSource: ctx.source,
      approvalRef: ctx.interactionRef ?? null,
    })
    .where(
      and(
        eq(draftsTable.id, draftId),
        // Only a draft still awaiting a decision may be approved. A sent,
        // edited, discarded or escalated draft is terminal.
        inArray(draftsTable.status, [...APPROVABLE_STATUSES]),
      ),
    )
    .returning({ id: draftsTable.id });

  if (!updated || updated.length === 0) {
    logger.info(
      { draftId, source: ctx.source, userId: ctx.userId },
      "recordApproval: draft is not in an approvable state — approval not recorded",
    );
    return { approved: false, reason: "draft is not in an approvable state" };
  }

  logger.info(
    { draftId, source: ctx.source, userId: ctx.userId, interactionRef: ctx.interactionRef },
    "recordApproval: approval recorded",
  );
  return { approved: true };
}
