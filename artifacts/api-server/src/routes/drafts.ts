import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, draftsTable, campaignsTable, clientsTable, personasTable, activityTable } from "@workspace/db";
import { postApprovalCard, isSlackConfigured } from "../lib/slack";
import {
  ListDraftsQueryParams,
  ListDraftsResponse,
  ListPendingDraftsResponse,
  GetDraftParams,
  GetDraftResponse,
  ApplyDraftActionParams,
  ApplyDraftActionBody,
  ApplyDraftActionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/drafts/pending", async (_req, res): Promise<void> => {
  const drafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.status, "pending"))
    .orderBy(draftsTable.createdAt);
  res.json(ListPendingDraftsResponse.parse(drafts));
});

router.get("/drafts", async (req, res): Promise<void> => {
  const query = ListDraftsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status) conditions.push(eq(draftsTable.status, query.data.status as "pending" | "sent" | "edited" | "discarded"));
  if (query.data.clientId != null) conditions.push(eq(draftsTable.clientId, query.data.clientId));
  if (query.data.campaignId != null) conditions.push(eq(draftsTable.campaignId, query.data.campaignId));

  const drafts = conditions.length > 0
    ? await db.select().from(draftsTable).where(and(...conditions)).orderBy(draftsTable.createdAt)
    : await db.select().from(draftsTable).orderBy(draftsTable.createdAt);

  res.json(ListDraftsResponse.parse(drafts));
});

router.get("/drafts/:id", async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, params.data.id));
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  res.json(GetDraftResponse.parse(draft));
});

router.patch("/drafts/:id/action", async (req, res): Promise<void> => {
  const params = ApplyDraftActionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ApplyDraftActionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { action, editedText } = body.data;
  const newStatus = action === "send" ? "sent" : action === "edit" ? "edited" : "discarded";

  // Fetch the current draft so we can detect a send_failed → success retry
  const [existingDraft] = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.id, params.data.id));

  if (!existingDraft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const isRetryFromFailure = existingDraft.status === "send_failed";

  // If retrying a previously-failed draft, remove the stale draft_send_failed activity
  // entry before inserting the success entry so the feed shows exactly one row per draft.
  if (isRetryFromFailure) {
    await db
      .delete(activityTable)
      .where(and(eq(activityTable.draftId, params.data.id), eq(activityTable.type, "draft_send_failed")));
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    actionedAt: new Date(),
  };
  if (action === "edit" && editedText) {
    updateData.editedReplyText = editedText;
  }

  const [draft] = await db
    .update(draftsTable)
    .set(updateData)
    .where(eq(draftsTable.id, params.data.id))
    .returning();

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  // Get campaign name for activity log
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));

  const activityTypeMap = { sent: "draft_sent", edited: "draft_edited", discarded: "draft_discarded" } as const;
  await db.insert(activityTable).values({
    type: activityTypeMap[newStatus as keyof typeof activityTypeMap],
    description: `Reply to ${draft.prospectName} (${draft.prospectEmail}) ${newStatus}`,
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    campaignName: campaign?.name ?? null,
  });

  res.json(ApplyDraftActionResponse.parse(draft));
});

// POST /api/drafts/:id/repost — re-post the Slack approval card for an existing draft.
// Resets status to "pending" and posts a fresh card. Safe to call on send_failed drafts.
// Does NOT create a new draft — no duplicate.
router.post("/drafts/:id/repost", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid draft id" });
    return;
  }

  if (!isSlackConfigured()) {
    res.status(503).json({ error: "Slack is not configured" });
    return;
  }

  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, id));
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  if (draft.status === "sent" || draft.status === "discarded") {
    res.status(409).json({ error: `Draft is already ${draft.status} — cannot repost` });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, draft.clientId));
  const persona = campaign?.personaId
    ? (await db.select().from(personasTable).where(eq(personasTable.id, campaign.personaId)))[0]
    : undefined;

  if (!client) {
    res.status(404).json({ error: "Client not found for draft" });
    return;
  }

  // Determine Slack channel — prefer real per-client Slack ID over placeholder
  const isSlackId = (c: string | null | undefined) => !!c && /^[CG][A-Z0-9]{9,}/.test(c);
  const rawEnvChannel = process.env.SLACK_CHANNEL_ID ?? "";
  const envChannelMatch = rawEnvChannel.match(/\b[CG][A-Z0-9]{9,11}\b/);
  const globalChannel = envChannelMatch ? envChannelMatch[0] : null;
  const approvalChannel = isSlackId(client.slackChannel)
    ? client.slackChannel
    : (globalChannel ?? client.slackChannel ?? "");

  if (!approvalChannel) {
    res.status(503).json({ error: "No Slack channel configured for this client" });
    return;
  }

  const isRealToken = (t: string | null | undefined) =>
    !!t && t.startsWith("xoxb-") && !t.includes("placeholder");
  const botToken = isRealToken(client.slackBotToken) ? (client.slackBotToken ?? undefined) : undefined;

  // Reset draft to pending (idempotent — safe to call even if already pending)
  await db.update(draftsTable)
    .set({ status: "pending", actionedAt: null, slackMessageTs: null })
    .where(eq(draftsTable.id, draft.id));

  // Post new approval card
  let slackTs: string | null = null;
  try {
    slackTs = await postApprovalCard({
      channelId: approvalChannel,
      botToken,
      draftId: draft.id,
      leadName: draft.prospectName,
      leadCompany: draft.prospectCompany ?? "",
      leadEmail: draft.prospectEmail,
      incomingReply: draft.conversationSnippet ?? "",
      generatedDraft: draft.replyText,
      campaignName: campaign?.name ?? "",
      personaName: persona?.name ?? "SDR",
      region: draft.prospectCountry ?? "US",
    });
  } catch (err) {
    req.log.error({ err, draftId: draft.id }, "repost: failed to post Slack approval card");
    // Restore original status so draft isn't stuck as pending with no card
    await db.update(draftsTable)
      .set({ status: "send_failed", actionedAt: new Date() })
      .where(eq(draftsTable.id, draft.id));
    res.status(502).json({ error: `Slack post failed: ${err instanceof Error ? err.message : String(err)}` });
    return;
  }

  if (slackTs) {
    await db.update(draftsTable)
      .set({ slackMessageTs: `${approvalChannel}|${slackTs}` })
      .where(eq(draftsTable.id, draft.id));
  }

  await db.insert(activityTable).values({
    type: "draft_created",
    description: `Slack approval card reposted for draft #${draft.id} (${draft.prospectName} / ${draft.prospectEmail})`,
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    campaignName: campaign?.name ?? null,
  });

  req.log.info({ draftId: draft.id, channel: approvalChannel, slackTs }, "repost: Slack approval card posted");

  res.json({ ok: true, draftId: draft.id, channel: approvalChannel, slackTs, duplicateCreated: false });
});

export default router;
