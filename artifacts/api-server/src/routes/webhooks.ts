import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import {
  db,
  draftsTable,
  logsTable,
  campaignsTable,
  clientsTable,
  personasTable,
  activityTable,
} from "@workspace/db";
import { generateDraftReply } from "../lib/claude";
import { postApprovalCard, isSlackConfigured, postUnmatchedCampaignAlert } from "../lib/slack";
import { isLemlistConfigured } from "../lib/lemlist";
import type { LemlistWebhookPayload } from "../lib/lemlist";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /webhooks/lemlist          ← canonical path — use this URL in Lemlist and n8n
// POST /webhooks/lemlist/reply    ← kept for backward compatibility; same handler
//
// Expected n8n workflow shape:
//   1. Webhook Trigger node  — receives Lemlist "emailReplied" event at N8N_WEBHOOK_URL
//   2. HTTP Request node     — POST to <APP_BASE_URL>/api/webhooks/lemlist
//                              Body: pass the Lemlist payload as-is (JSON)
//                              No extra headers required for unauthenticated dev; add
//                              an X-Webhook-Secret header for production hardening.
//
// Lemlist payload fields used: type, campaignId, leadId, leadEmail, leadFirstName,
//   leadLastName, leadCompanyName, country, jobTitle, replyText
async function receiveLemlistWebhook(
  req: import("express").Request,
  res: import("express").Response,
): Promise<void> {
  const payload = req.body as LemlistWebhookPayload;

  req.log.info(
    { type: payload.type, campaignId: payload.campaignId, leadEmail: payload.leadEmail },
    "Lemlist webhook received",
  );

  // Respond immediately so Lemlist / n8n don't time out
  res.status(200).json({ ok: true });

  // Process asynchronously
  void processLemlistReply(payload).catch((err) => {
    logger.error({ err }, "Error processing Lemlist webhook");
  });
}

router.post("/webhooks/lemlist", receiveLemlistWebhook);
router.post("/webhooks/lemlist/reply", receiveLemlistWebhook);

// POST /webhooks/lemlist/simulate — simulate a Lemlist webhook (for testing)
router.post("/webhooks/lemlist/simulate", async (req, res): Promise<void> => {
  const body = req.body as {
    campaignId?: string | number;
    leadName?: string;
    leadEmail?: string;
    leadCompany?: string;
    leadRole?: string;
    leadCountry?: string;
    replyText?: string;
  };

  const campaignId = String(body.campaignId ?? "1");
  const leadName = body.leadName ?? "Sarah Mitchell";
  const leadEmail = body.leadEmail ?? "sarah.mitchell@momentumlabs.io";

  const payload: LemlistWebhookPayload = {
    type: "emailReplied",
    campaignId,
    leadId: `lead_${Date.now()}`,
    leadEmail,
    leadFirstName: leadName.split(" ")[0],
    leadLastName: leadName.split(" ").slice(1).join(" "),
    leadCompanyName: body.leadCompany ?? "Momentum Labs",
    country: body.leadCountry ?? "US",
    jobTitle: body.leadRole ?? "VP of Sales",
    replyText: body.replyText ?? "Yes, interested. Can you send more details?",
  };

  req.log.info({ payload }, "Simulated Lemlist webhook");

  // Process synchronously so the caller gets the result
  try {
    const result = await processLemlistReply(payload);
    res.json({ ok: true, ...result, mock: !isLemlistConfigured() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Simulated webhook processing failed");
    res.status(500).json({ ok: false, error: msg });
  }
});

// ─── Core processing logic ──────────────────────────────────────────────────

async function processLemlistReply(payload: LemlistWebhookPayload): Promise<{
  draftId?: number;
  generatedDraft?: string;
  confidenceScore?: number;
  detectedIntent?: string;
  slackTs?: string | null;
}> {
  // 1. Find campaign by Lemlist campaign ID, with fallback to numeric DB ID
  const campaignIdStr = String(payload.campaignId);
  const numericId = parseInt(campaignIdStr, 10);
  const whereClause = !isNaN(numericId)
    ? or(eq(campaignsTable.lemlistCampaignId, campaignIdStr), eq(campaignsTable.id, numericId))
    : eq(campaignsTable.lemlistCampaignId, campaignIdStr);
  const [campaign] = await db.select().from(campaignsTable).where(whereClause);

  if (!campaign) {
    logger.warn({ campaignId: payload.campaignId }, "No DraftFly campaign found for Lemlist campaign ID");
    await db.insert(logsTable).values({
      level: "warning",
      message: `Lemlist webhook: no campaign mapping found for campaign ${payload.campaignId}`,
      source: "lemlist",
      leadId: payload.leadEmail ?? payload.leadId,
      metadata: JSON.stringify(payload),
    });
    await postUnmatchedCampaignAlert({
      leadEmail: payload.leadEmail ?? payload.leadId ?? "unknown",
      campaignId: campaignIdStr,
    });
    return {};
  }

  // 2. Find client
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, campaign.clientId));
  if (!client) {
    logger.warn({ clientId: campaign.clientId }, "Client not found for campaign");
    return {};
  }

  // 3. Find persona
  let persona = campaign.personaId
    ? (await db.select().from(personasTable).where(eq(personasTable.id, campaign.personaId)))[0]
    : null;

  const leadName = [payload.leadFirstName, payload.leadLastName].filter(Boolean).join(" ") || "there";
  const leadEmail = payload.leadEmail ?? "";
  const replyText = payload.replyText ?? payload.text ?? "";

  // 4. Generate Claude draft
  const draftResult = await generateDraftReply({
    leadName,
    leadEmail,
    leadCompany: payload.leadCompanyName ?? "",
    leadRole: payload.jobTitle,
    leadCountry: payload.country,
    incomingReply: replyText,
    personaName: persona?.name ?? "SDR",
    productDescription: persona?.productDescription ?? "AI-powered B2B reply automation",
    toneOfVoice: persona?.toneOfVoice ?? "Direct, concise, value-driven",
    commonObjections: persona?.commonObjections ?? undefined,
    cta: persona?.cta ?? "15-minute call",
    qualificationRules: persona?.qualificationRules ?? undefined,
    regionRules: campaign.regionRules ?? undefined,
    replyRules: campaign.replyRules ?? undefined,
  });

  // 5. Create draft record
  const [draft] = await db.insert(draftsTable).values({
    clientId: client.id,
    campaignId: campaign.id,
    prospectEmail: leadEmail,
    prospectName: leadName,
    prospectCompany: payload.leadCompanyName ?? null,
    prospectCountry: payload.country ?? null,
    prospectRole: payload.jobTitle ?? null,
    conversationSnippet: replyText,
    replyText: draftResult.draft,
    status: "pending",
    // store extra metadata in slackMessageTs field temporarily — will be overwritten
  }).returning();

  // 6. Log the event
  await db.insert(logsTable).values({
    clientId: client.id,
    campaignId: campaign.id,
    draftId: draft.id,
    leadId: payload.leadId ?? leadEmail,
    level: "info",
    message: `Lemlist reply from ${leadName} (${leadEmail}) — draft generated (confidence: ${Math.round(draftResult.confidenceScore * 100)}%)`,
    source: "lemlist",
    generatedDraft: draftResult.draft,
    metadata: JSON.stringify({
      detectedIntent: draftResult.detectedIntent,
      suggestedNextAction: draftResult.suggestedNextAction,
      confidenceScore: draftResult.confidenceScore,
    }),
  });

  // 7. Log Claude event
  await db.insert(logsTable).values({
    clientId: client.id,
    campaignId: campaign.id,
    draftId: draft.id,
    leadId: payload.leadId ?? leadEmail,
    level: "info",
    message: `Claude draft generated — intent: ${draftResult.detectedIntent}, confidence: ${Math.round(draftResult.confidenceScore * 100)}%, next: ${draftResult.suggestedNextAction}`,
    source: "claude",
    generatedDraft: draftResult.draft,
    metadata: JSON.stringify({}),
  });

  // 8. Activity feed
  await db.insert(activityTable).values({
    type: "draft_created",
    description: `Claude generated reply for ${leadName} (${leadEmail}) — ${campaign.name}`,
    clientId: client.id,
    campaignId: campaign.id,
    draftId: draft.id,
    campaignName: campaign.name,
  });

  // 9. Post Slack approval card
  // Fall back to global SLACK_CHANNEL_ID env var if client channel looks like a placeholder
  // Extract a valid Slack channel ID (C/G + 9-11 alphanumeric) from env var, in case it contains surrounding text
  const rawChannelEnv = process.env.SLACK_CHANNEL_ID ?? "";
  const channelIdMatch = rawChannelEnv.match(/\b[CG][A-Z0-9]{9,11}\b/);
  const globalChannelId = channelIdMatch ? channelIdMatch[0] : null;
  // Prefer client channel only if it's a real Slack ID (starts with C/G), not a #name or placeholder
  const isSlackId = (c: string | null | undefined) => !!c && /^[CG][A-Z0-9]{9,}/.test(c);
  const approvalChannel = isSlackId(client.slackChannel)
    ? client.slackChannel
    : (globalChannelId ?? client.slackChannel);
  let slackTs: string | null = null;

  // Use per-client token only if it looks like a real Slack token; fall back to global env var
  const isRealToken = (t: string | null | undefined) =>
    !!t && t.startsWith("xoxb-") && !t.includes("placeholder");
  const effectiveBotToken = isRealToken(client.slackBotToken)
    ? (client.slackBotToken ?? undefined)
    : undefined;

  try {
    slackTs = await postApprovalCard({
      channelId: approvalChannel,
      botToken: effectiveBotToken,
      draftId: draft.id,
      leadName,
      leadCompany: payload.leadCompanyName ?? "",
      leadEmail,
      incomingReply: replyText,
      generatedDraft: draftResult.draft,
      campaignName: campaign.name,
      personaName: persona?.name ?? "SDR",
      region: payload.country ?? "US",
      confidenceScore: draftResult.confidenceScore,
    });

    if (slackTs) {
      await db.update(draftsTable)
        .set({ slackMessageTs: `${approvalChannel}|${slackTs}` })
        .where(eq(draftsTable.id, draft.id));
    }

    await db.insert(logsTable).values({
      clientId: client.id,
      campaignId: campaign.id,
      draftId: draft.id,
      leadId: payload.leadId ?? leadEmail,
      level: "info",
      message: `Slack approval card posted to ${approvalChannel}${isSlackConfigured() ? "" : " (mock)"}`,
      source: "slack",
      metadata: JSON.stringify({ ts: slackTs, mock: !isSlackConfigured() }),
    });
  } catch (err) {
    logger.error({ err }, "Failed to post Slack approval card");
    await db.insert(logsTable).values({
      clientId: client.id,
      campaignId: campaign.id,
      draftId: draft.id,
      level: "error",
      message: `Failed to post Slack approval card: ${err instanceof Error ? err.message : String(err)}`,
      source: "slack",
    });
  }

  logger.info(
    { draftId: draft.id, slackTs, confidence: draftResult.confidenceScore },
    "Lemlist reply processed successfully",
  );

  return {
    draftId: draft.id,
    generatedDraft: draftResult.draft,
    confidenceScore: draftResult.confidenceScore,
    detectedIntent: draftResult.detectedIntent,
    slackTs,
  };
}

export default router;
