import { pgTable, serial, text, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const draftStatusEnum = pgEnum("draft_status", ["pending", "sent", "edited", "discarded", "send_failed", "escalated", "skipped"]);

/**
 * Where an approval came from. Only a verified human interaction on one of these
 * surfaces may flip `approved` to true — see lib/approvalGate.ts in api-server.
 * There is deliberately no "system", "timer" or "api" member: no background job
 * is allowed to approve a reply.
 */
export const approvalSourceEnum = pgEnum("approval_source", ["slack", "telegram"]);

export const draftsTable = pgTable("drafts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  campaignId: integer("campaign_id").notNull(),
  prospectEmail: text("prospect_email").notNull(),
  prospectName: text("prospect_name").notNull(),
  prospectCompany: text("prospect_company"),
  prospectCountry: text("prospect_country"),
  prospectRole: text("prospect_role"),
  conversationSnippet: text("conversation_snippet"),
  replyText: text("reply_text").notNull(),
  editedReplyText: text("edited_reply_text"),
  status: draftStatusEnum("status").notNull().default("pending"),
  slackMessageTs: text("slack_message_ts"),
  actionedAt: timestamp("actioned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

  // ── Approval gate ─────────────────────────────────────────────────────────
  // Persisted proof that a human approved this reply. approveAndSend() refuses
  // to contact Lemlist unless `approved` is true AND the provenance columns
  // below name a legitimate interactive surface.
  approved: boolean("approved").notNull().default(false),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvalSource: approvalSourceEnum("approval_source"),
  /** Slack/Telegram interaction id the approval came from — for audit. */
  approvalRef: text("approval_ref"),
});

export const insertDraftSchema = createInsertSchema(draftsTable).omit({ id: true, createdAt: true, actionedAt: true });
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof draftsTable.$inferSelect;
