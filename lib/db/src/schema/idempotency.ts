import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Idempotency ledger for INBOUND Lemlist replies.
 *
 * One row per unique reply event. The UNIQUE constraint on `idempotencyKey` is
 * what makes "process this reply exactly once" atomic — the claim is an
 * `INSERT ... ON CONFLICT DO NOTHING RETURNING id`, so two concurrent webhook
 * deliveries race on the database, not in application code.
 *
 * Key shape: `<campaignId>:<leadId|leadEmail>:<messageId|hash(replyText)>`
 * (built by buildInboundIdempotencyKey in api-server/src/lib/idempotency.ts).
 */
export const inboundRepliesTable = pgTable(
  "inbound_replies",
  {
    id: serial("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    campaignId: text("campaign_id"),
    leadId: text("lead_id"),
    leadEmail: text("lead_email"),
    /** Draft produced by this reply, once one exists. */
    draftId: integer("draft_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("inbound_replies_idempotency_key_uidx").on(t.idempotencyKey)],
);

export type InboundReply = typeof inboundRepliesTable.$inferSelect;

/**
 * Idempotency ledger for OUTBOUND sends.
 *
 * One row per reply actually dispatched to Lemlist. approveAndSend() claims a
 * row *before* calling the Lemlist API; if the claim conflicts, the send is
 * already owned by another attempt and this one is skipped. On a failed send
 * the claim is released so an operator can retry from Slack.
 *
 * Key shape: `draft:<draftId>` — one send per draft, forever.
 */
export const replySendsTable = pgTable(
  "reply_sends",
  {
    id: serial("id").primaryKey(),
    sendKey: text("send_key").notNull(),
    draftId: integer("draft_id").notNull(),
    approvedBy: text("approved_by"),
    approvalSource: text("approval_source"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("reply_sends_send_key_uidx").on(t.sendKey)],
);

export type ReplySend = typeof replySendsTable.$inferSelect;
