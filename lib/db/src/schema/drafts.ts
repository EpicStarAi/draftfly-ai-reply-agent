import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const draftStatusEnum = pgEnum("draft_status", ["pending", "sent", "edited", "discarded", "send_failed"]);

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
});

export const insertDraftSchema = createInsertSchema(draftsTable).omit({ id: true, createdAt: true, actionedAt: true });
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof draftsTable.$inferSelect;
