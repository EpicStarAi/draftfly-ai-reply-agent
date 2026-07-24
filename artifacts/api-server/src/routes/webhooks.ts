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
import { generateDraftReply, isValidDraftText } from "../lib/claude";
import { postApprovalCard, isSlackConfigured, postUnmatchedCampaignAlert } from "../lib/slack";
import { isLemlistConfigured, requireWebhookSecret } from "../lib/lemlist";
import type { LemlistWebhookPayload } from "../lib/lemlist";
import { claimInboundReply, linkClaimToDraft, releaseInboundClaim } from "../lib/idempotency";
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

router.post("/webhooks/lemlist", requireWebhookSecret, receiveLemlistWebhook);
router.post("/webhooks/lemlist/reply", requireWebhookSecret, receiveLemlistWebhook);

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

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Claude occasionally wraps its reply in a JSON object or markdown code block.
 * This function strips all wrappers and returns just the plain draft text.
 * Handles: plain JSON `{"draft":"..."}`, markdown ```json {...} ```, and raw text.
 */
function extractDraftText(raw: string): string {
  const trimmed = raw.trim();

  // Strip markdown code block: ```json {...} ``` or ``` {...} ```
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  const innerText = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;

  // Try to parse as JSON and extract the draft field
  if (innerText.startsWith("{")) {
    try {
      const parsed = JSON.parse(innerText) as Record<string, unknown>;
      for (const key of ["draft", "reply", "text", "message", "content"]) {
        if (typeof parsed[key] === "string") {
          return (parsed[key] as string).trim();
        }
      }
    } catch {
      // Not valid JSON — fall through
    }
  }

  // If we stripped a code block but couldn't parse JSON, return the inner text
  if (codeBlockMatch) return innerText;

  return raw;
}

// ─── Auto-reply / bounce detection ─────────────────────────────────────────

const AUTO_REPLY_PATTERNS = [
  /out of office/i,
  /out-of-office/i,
  /on vacation/i,
  /on leave/i,
  /automatic reply/i,
  /auto-reply/i,
  /autoreply/i,
  /automated response/i,
  /vacation response/i,
  /away from (the )?office/i,
  /currently unavailable/i,
  /MAILER-DAEMON/i,
  /delivery (status notification|failed|failure)/i,
  /undeliverable/i,
  /mail delivery (failed|subsystem)/i,
  /postmaster@/i,
  /do not reply/i,
  /noreply@/i,
  /no-reply@/i,
];

function isAutoReply(text: string, fromEmail?: string): boolean {
  if (AUTO_REPLY_PATTERNS.some((p) => p.test(text))) return true;
  if (fromEmail && AUTO_REPLY_PATTERNS.some((p) => p.test(fromEmail))) return true;
  return false;
}

// ─── Core processing logic ──────────────────────────────────────────────────

interface ProcessResult {
  draftId?: number;
  generatedDraft?: string;
  confidenceScore?: number;
  detectedIntent?: string;
  slackTs?: string | null;
  /** True when this delivery was a duplicate and nothing was done. */
  duplicate?: boolean;
}

/**
 * Idempotent entry point for an inbound Lemlist reply.
 *
 * Claims the event against a UNIQUE index before doing any work. A redelivery
 * of the same reply — Lemlist retry, n8n retry, double-fire — is dropped here,
 * so it can never produce a second draft or a second approval card.
 */
async function processLemlistReply(payload: LemlistWebhookPayload): Promise<ProcessResult> {
  const claim = await claimInboundReply(payload);
  if (!claim.claimed) {
    return { duplicate: true };
  }

  try {
    const result = await generateDraftForReply(payload);
    if (result.draftId) {
      await linkClaimToDraft(claim.idempotencyKey, result.draftId);
    } else {
      // No draft was produced (auto-reply, unmatched campaign, missing client).
      // The claim stays: re-processing the same event would reach the same
      // conclusion and only add noise.
      logger.debug(
        { idempotencyKey: claim.idempotencyKey },
        "processLemlistReply: no draft produced — claim retained",
      );
    }
    return result;
  } catch (err) {
    // Processing blew up before a draft existed — release the claim so a
    // genuine Lemlist retry is still able to get through.
    await releaseInboundClaim(claim.idempotencyKey);
    throw err;
  }
}

async function generateDraftForReply(payload: LemlistWebhookPayload): Promise<ProcessResult> {
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

  // 4. Detect auto-replies, bounces, OOO — skip draft generation for system messages
  if (isAutoReply(replyText, leadEmail)) {
    logger.info({ leadEmail, campaignId: payload.campaignId }, "Auto-reply/bounce detected — skipping draft generation");
    await db.insert(logsTable).values({
      clientId: client.id,
      campaignId: campaign.id,
      leadId: payload.leadId ?? leadEmail,
      level: "info",
      message: `Auto-reply or bounce detected from ${leadEmail} — no draft created`,
      source: "system",
      metadata: JSON.stringify({ replyText: replyText.slice(0, 200) }),
    });
    await db.insert(activityTable).values({
      type: "draft_skipped",
      description: `Auto-reply / bounce from ${leadEmail} — draft skipped (${campaign.name})`,
      clientId: client.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
    });
    return {};
  }

  // 5. Generate Claude draft
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

  // 5. Create draft record — validate extracted text first
  const cleanDraft = extractDraftText(draftResult.draft);

  if (!isValidDraftText(cleanDraft)) {
    logger.error(
      { rawLength: draftResult.draft.length, cleanLength: cleanDraft.trim().length, leadEmail },
      "Claude output failed draft validation — raw AI text is empty or too short to be a real reply",
    );
    const [failedDraft] = await db.insert(draftsTable).values({
      clientId: client.id,
      campaignId: campaign.id,
      prospectEmail: leadEmail,
      prospectName: leadName,
      prospectCompany: payload.leadCompanyName ?? null,
      prospectCountry: payload.country ?? null,
      prospectRole: payload.jobTitle ?? null,
      conversationSnippet: replyText,
      replyText: "[Draft generation failed — AI output could not be parsed as a valid reply]",
      status: "send_failed",
    }).returning();
    await db.insert(logsTable).values({
      clientId: client.id,
      campaignId: campaign.id,
      draftId: failedDraft.id,
      leadId: payload.leadId ?? leadEmail,
      level: "error",
      message: `Draft validation failed for ${leadName} (${leadEmail}) — AI returned an empty or unparseable reply (${cleanDraft.trim().length} chars after unwrapping)`,
      source: "claude",
      metadata: JSON.stringify({ rawDraft: draftResult.draft.slice(0, 500) }),
    });
    return { draftId: failedDraft.id };
  }

  const [draft] = await db.insert(draftsTable).values({
    clientId: client.id,
    campaignId: campaign.id,
    prospectEmail: leadEmail,
    prospectName: leadName,
    prospectCompany: payload.leadCompanyName ?? null,
    prospectCountry: payload.country ?? null,
    prospectRole: payload.jobTitle ?? null,
    conversationSnippet: replyText,
    replyText: cleanDraft,
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
    generatedDraft: cleanDraft,
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
    generatedDraft: cleanDraft,
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
      generatedDraft: cleanDraft,
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
    generatedDraft: cleanDraft,
    confidenceScore: draftResult.confidenceScore,
    detectedIntent: draftResult.detectedIntent,
    slackTs,
  };
}

export default router;
