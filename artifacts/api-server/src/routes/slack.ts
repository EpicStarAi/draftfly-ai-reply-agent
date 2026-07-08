import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, draftsTable, logsTable, campaignsTable, clientsTable, activityTable } from "@workspace/db";
import {
  verifyIncomingRequest,
  postTestMessage,
  updateMessageAfterAction,
  postApprovalCard,
  isSlackConfigured,
} from "../lib/slack";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /slack/actions — handle Slack block_action payloads (Send / Edit / Discard)
router.post("/slack/actions", async (req, res): Promise<void> => {
  const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

  // Verify signature
  if (!verifyIncomingRequest(rawBody, req.headers as Record<string, string | undefined>)) {
    req.log.warn("Slack signature verification failed");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Slack sends actions as URL-encoded payload field
  let payload: Record<string, unknown>;
  try {
    const raw = req.body as { payload?: string } | Record<string, unknown>;
    payload = typeof raw.payload === "string"
      ? JSON.parse(raw.payload) as Record<string, unknown>
      : raw;
  } catch {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const actions = payload.actions as Array<{ action_id: string; value: string }> | undefined;
  if (!actions || actions.length === 0) {
    res.status(200).json({});
    return;
  }

  const action = actions[0];
  const draftId = parseInt(action.value, 10);
  const userId = (payload.user as { id?: string } | undefined)?.id ?? "unknown";
  const teamId = (payload.team as { id?: string } | undefined)?.id ?? "unknown";

  req.log.info({ action: action.action_id, draftId, userId, teamId }, "Slack block action received");

  if (isNaN(draftId)) {
    res.status(400).json({ error: "Invalid draft ID in action value" });
    return;
  }

  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, draftId));
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  // Determine new status
  const actionMap: Record<string, "sent" | "edited" | "discarded"> = {
    draft_send: "sent",
    draft_edit: "edited",
    draft_discard: "discarded",
  };
  const newStatus = actionMap[action.action_id];
  if (!newStatus) {
    res.status(400).json({ error: `Unknown action: ${action.action_id}` });
    return;
  }

  // Update draft
  await db.update(draftsTable).set({ status: newStatus, actionedAt: new Date() }).where(eq(draftsTable.id, draftId));

  // Log the action
  await db.insert(logsTable).values({
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    leadId: draft.prospectEmail,
    level: "info",
    message: `Slack action ${action.action_id} by ${userId} on draft ${draftId}`,
    source: "slack",
    finalStatus: newStatus,
    metadata: JSON.stringify({ userId, teamId, action: action.action_id }),
  });

  // Write to activity feed
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));
  const activityTypeMap = { sent: "draft_sent", edited: "draft_edited", discarded: "draft_discarded" } as const;
  await db.insert(activityTable).values({
    type: activityTypeMap[newStatus],
    description: `Slack: reply to ${draft.prospectName} (${draft.prospectEmail}) ${newStatus}`,
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    campaignName: campaign?.name ?? null,
  });

  // Update Slack message to reflect decision
  if (draft.slackMessageTs) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, draft.clientId));
    void updateMessageAfterAction(
      draft.slackMessageTs.split("|")[0], // channel
      draft.slackMessageTs.split("|")[1] ?? draft.slackMessageTs,
      newStatus,
      userId,
      client?.slackBotToken ?? undefined,
    ).catch((err) => req.log.warn({ err }, "Failed to update Slack message"));
  }

  // Acknowledge Slack immediately (must respond within 3s)
  res.status(200).json({});
});

// POST /slack/test-message — send a test approval card to a channel
router.post("/slack/test-message", async (req, res): Promise<void> => {
  const body = req.body as { channelId?: string; botToken?: string };
  if (!body.channelId) {
    res.status(400).json({ error: "channelId is required" });
    return;
  }

  const result = await postTestMessage(body.channelId, body.botToken);
  res.json(result);
});

// POST /slack/send-approval — manually post an approval card for a draft
router.post("/slack/send-approval", async (req, res): Promise<void> => {
  const body = req.body as { draftId?: number; channelId?: string };
  if (!body.draftId || !body.channelId) {
    res.status(400).json({ error: "draftId and channelId are required" });
    return;
  }

  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, body.draftId));
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));

  const ts = await postApprovalCard({
    channelId: body.channelId,
    draftId: draft.id,
    leadName: draft.prospectName,
    leadCompany: draft.prospectCompany ?? "",
    leadEmail: draft.prospectEmail,
    incomingReply: draft.conversationSnippet ?? "",
    generatedDraft: draft.replyText,
    campaignName: campaign?.name ?? "Unknown Campaign",
    personaName: "SDR",
    region: draft.prospectCountry ?? "US",
  });

  // Store ts so we can update the message later
  if (ts) {
    await db.update(draftsTable)
      .set({ slackMessageTs: `${body.channelId}|${ts}` })
      .where(eq(draftsTable.id, draft.id));
  }

  req.log.info({ draftId: draft.id, ts, mock: !isSlackConfigured() }, "Approval card posted");
  res.json({ ok: true, ts, mock: !isSlackConfigured() });
});

export default router;
