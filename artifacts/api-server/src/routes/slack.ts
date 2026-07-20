import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, draftsTable, logsTable, campaignsTable, clientsTable, activityTable } from "@workspace/db";
import {
  verifyIncomingRequest,
  postTestMessage,
  updateMessageAfterAction,
  postApprovalCard,
  openEditModal,
  isSlackConfigured,
} from "../lib/slack";
import { sendReply } from "../lib/lemlist";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Background action processor ───────────────────────────────────────────
// Runs after Slack has been acknowledged. Handles DB updates, Lemlist dispatch,
// and Slack message updates without blocking the 3-second ack window.

async function processSlackAction(params: {
  draftId: number;
  newStatus: "sent" | "edited" | "discarded" | "send_failed";
  actionId: string;
  userId: string;
  teamId: string;
}): Promise<void> {
  const { draftId, newStatus, actionId, userId, teamId } = params;

  // Fetch draft
  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, draftId));
  if (!draft) {
    logger.warn({ draftId }, "processSlackAction: draft not found");
    return;
  }

  // Idempotency guard — ignore if already in a terminal success state (protects against Slack retries).
  // send_failed drafts are retryable so we allow them through.
  if (draft.status === "sent" || draft.status === "edited" || draft.status === "discarded") {
    logger.info({ draftId, status: draft.status }, "Draft already actioned — ignoring duplicate Slack interaction");
    return;
  }

  // Fetch campaign (needed for Lemlist send and activity log)
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, draft.clientId));
  const botToken = client?.slackBotToken ?? undefined;

  let finalStatus = newStatus;
  let lemlistError: string | undefined;

  // For "send" — call Lemlist first. Only mark sent if it succeeds.
  if (newStatus === "sent") {
    if (!campaign) {
      logger.error({ draftId }, "Campaign not found — cannot send reply via Lemlist");
      // Notify Slack and bail without changing draft status
      if (draft.slackMessageTs) {
        const [channel, ts] = draft.slackMessageTs.split("|");
        void updateMessageAfterAction(
          channel,
          ts ?? channel,
          "send_failed",
          userId,
          botToken,
          "Campaign not found",
        );
      }
      return;
    }

    const replyText = draft.editedReplyText ?? draft.replyText;
    try {
      const result = await sendReply({
        leadId: draft.prospectEmail,
        campaignId: campaign.lemlistCampaignId,
        replyText,
      });
      if (!result.ok) {
        lemlistError = result.error;
        logger.error({ draftId, lemlistError }, "Lemlist sendReply failed — draft left pending");
        finalStatus = "pending" as unknown as "sent"; // keep pending; cast to reuse variable
      }
    } catch (err) {
      lemlistError = err instanceof Error ? err.message : String(err);
      logger.error({ err, draftId }, "Lemlist sendReply threw — draft left pending");
      finalStatus = "pending" as unknown as "sent";
    }

    // If Lemlist failed, mark draft as send_failed, log, write activity, update Slack message
    if (lemlistError) {
      await db.update(draftsTable)
        .set({ status: "send_failed", actionedAt: new Date() })
        .where(eq(draftsTable.id, draftId));

      await db.insert(logsTable).values({
        clientId: draft.clientId,
        campaignId: draft.campaignId,
        draftId: draft.id,
        leadId: draft.prospectEmail,
        level: "warning",
        message: `Slack action ${actionId} by ${userId}: Lemlist send failed — ${lemlistError}`,
        source: "slack",
        finalStatus: "send_failed",
        metadata: JSON.stringify({ userId, teamId, action: actionId, lemlistError }),
      });

      await db.insert(activityTable).values({
        type: "draft_send_failed",
        description: `Lemlist send failed for reply to ${draft.prospectName} (${draft.prospectEmail}): ${lemlistError}`,
        clientId: draft.clientId,
        campaignId: draft.campaignId,
        draftId: draft.id,
        campaignName: campaign?.name ?? null,
      });

      if (draft.slackMessageTs) {
        const [channel, ts] = draft.slackMessageTs.split("|");
        void updateMessageAfterAction(
          channel,
          ts ?? channel,
          "send_failed",
          userId,
          botToken,
          lemlistError,
        );
      }
      return;
    }
  }

  // Update draft status
  await db.update(draftsTable)
    .set({ status: finalStatus as "sent" | "edited" | "discarded", actionedAt: new Date() })
    .where(eq(draftsTable.id, draftId));

  // Log the action
  await db.insert(logsTable).values({
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    leadId: draft.prospectEmail,
    level: "info",
    message: `Slack action ${actionId} by ${userId} on draft ${draftId}`,
    source: "slack",
    finalStatus: finalStatus as "sent" | "edited" | "discarded",
    metadata: JSON.stringify({ userId, teamId, action: actionId }),
  });

  // Write to activity feed
  const activityTypeMap = { sent: "draft_sent", edited: "draft_edited", discarded: "draft_discarded" } as const;
  const resolvedStatus = finalStatus as "sent" | "edited" | "discarded";
  await db.insert(activityTable).values({
    type: activityTypeMap[resolvedStatus],
    description: `Slack: reply to ${draft.prospectName} (${draft.prospectEmail}) ${resolvedStatus}`,
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    campaignName: campaign?.name ?? null,
  });

  // Update Slack message to reflect the decision (non-blocking)
  if (draft.slackMessageTs) {
    const [channel, ts] = draft.slackMessageTs.split("|");
    void updateMessageAfterAction(
      channel,
      ts ?? channel,
      resolvedStatus,
      userId,
      botToken,
    ).catch((err) => logger.warn({ err }, "Failed to update Slack message"));
  }
}

// ─── Edit modal submission processor ────────────────────────────────────────
// Runs after Slack has been acknowledged. Saves edited text, sends via Lemlist,
// and updates the Slack message to show the final sent text.

async function processEditSubmission(params: {
  draftId: number;
  editedText: string;
  userId: string;
  teamId: string;
}): Promise<void> {
  const { draftId, editedText, userId, teamId } = params;

  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, draftId));
  if (!draft) {
    logger.warn({ draftId }, "processEditSubmission: draft not found");
    return;
  }

  // Idempotency guard — allow send_failed drafts to be retried via modal resubmit
  if (draft.status === "sent" || draft.status === "edited" || draft.status === "discarded") {
    logger.info({ draftId, status: draft.status }, "Draft already actioned — ignoring modal submit");
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, draft.clientId));
  const botToken = client?.slackBotToken ?? undefined;

  // Save edited text
  await db.update(draftsTable)
    .set({ editedReplyText: editedText })
    .where(eq(draftsTable.id, draftId));

  if (!campaign) {
    logger.error({ draftId }, "Campaign not found — cannot send edited reply via Lemlist");
    if (draft.slackMessageTs) {
      const [channel, ts] = draft.slackMessageTs.split("|");
      void updateMessageAfterAction(channel, ts ?? channel, "send_failed", userId, botToken, "Campaign not found");
    }
    return;
  }

  let lemlistError: string | undefined;
  try {
    const result = await sendReply({
      leadId: draft.prospectEmail,
      campaignId: campaign.lemlistCampaignId,
      replyText: editedText,
    });
    if (!result.ok) {
      lemlistError = result.error;
      logger.error({ draftId, lemlistError }, "Lemlist sendReply failed after edit — draft left pending");
    }
  } catch (err) {
    lemlistError = err instanceof Error ? err.message : String(err);
    logger.error({ err, draftId }, "Lemlist sendReply threw after edit — draft left pending");
  }

  if (lemlistError) {
    await db.update(draftsTable)
      .set({ status: "send_failed", actionedAt: new Date() })
      .where(eq(draftsTable.id, draftId));

    await db.insert(logsTable).values({
      clientId: draft.clientId,
      campaignId: draft.campaignId,
      draftId: draft.id,
      leadId: draft.prospectEmail,
      level: "warning",
      message: `Slack modal edit submit by ${userId}: Lemlist send failed — ${lemlistError}`,
      source: "slack",
      finalStatus: "send_failed",
      metadata: JSON.stringify({ userId, teamId, action: "draft_edit_modal", lemlistError }),
    });

    await db.insert(activityTable).values({
      type: "draft_send_failed",
      description: `Lemlist send failed for edited reply to ${draft.prospectName} (${draft.prospectEmail}): ${lemlistError}`,
      clientId: draft.clientId,
      campaignId: draft.campaignId,
      draftId: draft.id,
      campaignName: campaign?.name ?? null,
    });

    if (draft.slackMessageTs) {
      const [channel, ts] = draft.slackMessageTs.split("|");
      void updateMessageAfterAction(channel, ts ?? channel, "send_failed", userId, botToken, lemlistError);
    }
    return;
  }

  // Mark as sent
  await db.update(draftsTable)
    .set({ status: "sent", actionedAt: new Date() })
    .where(eq(draftsTable.id, draftId));

  await db.insert(logsTable).values({
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    leadId: draft.prospectEmail,
    level: "info",
    message: `Slack modal edit submitted and sent by ${userId} on draft ${draftId}`,
    source: "slack",
    finalStatus: "sent",
    metadata: JSON.stringify({ userId, teamId, action: "draft_edit_modal" }),
  });

  await db.insert(activityTable).values({
    type: "draft_sent",
    description: `Slack: edited reply to ${draft.prospectName} (${draft.prospectEmail}) sent`,
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    campaignName: campaign.name ?? null,
  });

  // Update Slack message with "✏️ Reply edited and sent" and the final reply text
  if (draft.slackMessageTs) {
    const [channel, ts] = draft.slackMessageTs.split("|");
    void updateMessageAfterAction(channel, ts ?? channel, "edited", userId, botToken, undefined, editedText)
      .catch((err) => logger.warn({ err }, "Failed to update Slack message after edit submit"));
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// POST /slack/actions — handle Slack block_action payloads (Send / Edit / Discard)
//                       and view_submission payloads (Edit modal submit)
router.post("/slack/actions", async (req, res): Promise<void> => {
  const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

  // Verify Slack signature before doing anything else
  if (!verifyIncomingRequest(rawBody, req.headers as Record<string, string | undefined>)) {
    req.log.warn("Slack signature verification failed");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Parse the payload (Slack sends URL-encoded with a nested JSON `payload` field)
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

  const payloadType = payload.type as string | undefined;
  const userId = (payload.user as { id?: string } | undefined)?.id ?? "unknown";
  const teamId = (payload.team as { id?: string } | undefined)?.id ?? "unknown";

  // ── view_submission: Edit modal submitted ──────────────────────────────────
  if (payloadType === "view_submission") {
    const view = payload.view as {
      callback_id?: string;
      private_metadata?: string;
      state?: { values?: Record<string, Record<string, { value?: string }>> };
    } | undefined;

    if (view?.callback_id !== "draft_edit_modal") {
      // Unknown modal — ack and ignore
      res.status(200).json({});
      return;
    }

    const draftId = parseInt(view.private_metadata ?? "", 10);
    if (isNaN(draftId)) {
      res.status(400).json({ error: "Invalid draft ID in modal metadata" });
      return;
    }

    const editedText = view.state?.values?.reply_text_block?.reply_text?.value ?? "";
    if (!editedText.trim()) {
      // Return a validation error inside the modal rather than closing it
      res.status(200).json({
        response_action: "errors",
        errors: { reply_text_block: "Reply text cannot be empty." },
      });
      return;
    }

    req.log.info({ draftId, userId, teamId }, "Slack modal edit submitted");

    // Ack to close the modal, then process asynchronously
    res.status(200).json({});

    void processEditSubmission({ draftId, editedText, userId, teamId })
      .catch((err) => req.log.error({ err, draftId }, "processEditSubmission failed unexpectedly"));
    return;
  }

  // ── block_actions: Send / Edit / Discard buttons ───────────────────────────
  const actions = payload.actions as Array<{ action_id: string; value: string }> | undefined;
  if (!actions || actions.length === 0) {
    res.status(200).json({});
    return;
  }

  const action = actions[0];
  const draftId = parseInt(action.value, 10);
  if (isNaN(draftId)) {
    res.status(400).json({ error: "Invalid draft ID in action value" });
    return;
  }

  req.log.info({ action: action.action_id, draftId, userId, teamId }, "Slack block action received");

  // ✏️ Edit Reply — open a Slack modal pre-populated with the AI draft
  if (action.action_id === "draft_edit") {
    const triggerId = payload.trigger_id as string | undefined;
    if (!triggerId) {
      res.status(400).json({ error: "Missing trigger_id for modal open" });
      return;
    }

    // Fetch the draft text to pre-populate the modal
    const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, draftId));
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, draft.clientId));
    const botToken = client?.slackBotToken ?? undefined;

    // Ack Slack immediately, then open the modal asynchronously.
    // trigger_id is valid for 3 seconds from when Slack sent the action; the
    // modal open call is fired within milliseconds of the ack, well within limit.
    res.status(200).json({});

    void openEditModal({
      triggerId,
      draftId,
      currentText: draft.editedReplyText ?? draft.replyText,
      botToken,
    }).catch((err) => req.log.error({ err, draftId }, "openEditModal failed"));
    return;
  }

  const actionMap: Record<string, "sent" | "discarded"> = {
    draft_send: "sent",
    draft_discard: "discarded",
  };
  const newStatus = actionMap[action.action_id];
  if (!newStatus) {
    res.status(400).json({ error: `Unknown action: ${action.action_id}` });
    return;
  }

  // Acknowledge Slack immediately — must respond within 3 seconds.
  // All processing (DB updates, Lemlist call, Slack message update) runs asynchronously.
  res.status(200).json({});

  void processSlackAction({ draftId, newStatus, actionId: action.action_id, userId, teamId })
    .catch((err) => req.log.error({ err, draftId }, "processSlackAction failed unexpectedly"));
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
