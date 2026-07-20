import crypto from "crypto";
import { WebClient, type KnownBlock } from "@slack/web-api";
import { logger } from "./logger";

// ─── Configuration ─────────────────────────────────────────────────────────

export function isSlackConfigured(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET);
}

export function getSlackStatus(): { configured: boolean; appId: string | null; clientId: string | null } {
  return {
    configured: isSlackConfigured(),
    appId: process.env.SLACK_APP_ID ?? null,
    clientId: process.env.SLACK_CLIENT_ID ?? null,
  };
}

function getClient(botToken?: string): WebClient {
  const token = botToken ?? process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not configured. Add it to Replit Secrets to enable Slack integration.");
  return new WebClient(token);
}

// ─── Signature verification ────────────────────────────────────────────────

export function verifySlackSignature(
  signingSecret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  const fiveMinutes = 5 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > fiveMinutes) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(baseString);
  const computed = `v0=${hmac.digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function verifyIncomingRequest(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    logger.warn("SLACK_SIGNING_SECRET not set — rejecting request");
    return false;
  }
  const timestamp = String(headers["x-slack-request-timestamp"] ?? "");
  const signature = String(headers["x-slack-signature"] ?? "");
  return verifySlackSignature(secret, rawBody, timestamp, signature);
}

// ─── Message posting ───────────────────────────────────────────────────────

export interface ApprovalCardParams {
  channelId: string;
  botToken?: string;
  draftId: number;
  leadName: string;
  leadCompany: string;
  leadEmail: string;
  incomingReply: string;
  generatedDraft: string;
  campaignName: string;
  personaName: string;
  region: string;
  confidenceScore?: number;
}

export async function postApprovalCard(params: ApprovalCardParams): Promise<string | null> {
  if (!isSlackConfigured() && !params.botToken) {
    throw new Error("Slack is not configured. Add SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET to Replit Secrets.");
  }

  const client = getClient(params.botToken);
  const confidenceLine = params.confidenceScore != null
    ? ` · Confidence: ${Math.round(params.confidenceScore * 100)}%`
    : "";

  const result = await client.chat.postMessage({
    channel: params.channelId,
    text: `New reply from ${params.leadName} — approval required`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*New reply from ${params.leadName}* — ${params.leadCompany}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `> _"${params.incomingReply}"_`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Claude Draft:*\n${params.generatedDraft}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `#${params.campaignName} · Persona: ${params.personaName} · ${params.region}${confidenceLine}`,
          },
        ],
      },
      { type: "divider" },
      {
        type: "actions",
        block_id: `draft_${params.draftId}`,
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "✅ Send Reply" },
            style: "primary",
            action_id: "draft_send",
            value: String(params.draftId),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "✏️ Edit Reply" },
            action_id: "draft_edit",
            value: String(params.draftId),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "🗑️ Discard" },
            style: "danger",
            action_id: "draft_discard",
            value: String(params.draftId),
          },
        ],
      },
    ],
  });
  return result.ts ?? null;
}

export async function postUnmatchedCampaignAlert(params: {
  leadEmail: string;
  campaignId: string;
}): Promise<void> {
  const rawChannelEnv = process.env.SLACK_CHANNEL_ID ?? "";
  const channelIdMatch = rawChannelEnv.match(/\b[CG][A-Z0-9]{9,11}\b/);
  const channelId = channelIdMatch ? channelIdMatch[0] : null;

  if (!channelId) {
    logger.warn(
      { campaignId: params.campaignId },
      "Unmatched Lemlist campaign — no SLACK_CHANNEL_ID configured, cannot send alert",
    );
    return;
  }

  if (!isSlackConfigured()) {
    logger.warn(
      { campaignId: params.campaignId, channelId },
      "Unmatched Lemlist campaign — Slack not configured, skipping alert",
    );
    return;
  }

  try {
    const client = getClient();
    await client.chat.postMessage({
      channel: channelId,
      text: `⚠️ Received reply from ${params.leadEmail} for unknown campaign \`${params.campaignId}\` — add it in DraftFly to enable auto-drafting`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `⚠️ *Unmatched Lemlist campaign*\n\nReceived a reply from *${params.leadEmail}* for campaign ID \`${params.campaignId}\`, but no matching campaign was found in DraftFly.\n\nAdd the campaign in DraftFly and map it to this Lemlist campaign ID to enable auto-drafting.`,
          },
        },
      ],
    });
  } catch (err) {
    logger.error({ err, campaignId: params.campaignId }, "Failed to post unmatched campaign Slack alert");
  }
}

export async function postTestMessage(channelId: string, botToken?: string): Promise<{ ok: boolean; ts?: string; error?: string }> {
  if (!isSlackConfigured() && !botToken) {
    return { ok: false, error: "SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET are not configured" };
  }

  try {
    const client = getClient(botToken);
    const result = await client.chat.postMessage({
      channel: channelId,
      text: "✅ DraftFly test message — Slack connection verified.",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*DraftFly* — test connection successful.\nYour approval channel is correctly configured.",
          },
        },
      ],
    });
    return { ok: true, ts: result.ts };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Slack test message failed");
    return { ok: false, error: msg };
  }
}

export async function openEditModal(params: {
  triggerId: string;
  draftId: number;
  currentText: string;
  botToken?: string;
}): Promise<void> {
  if (!isSlackConfigured() && !params.botToken) {
    logger.warn({ draftId: params.draftId }, "openEditModal: Slack not configured, cannot open modal");
    return;
  }

  const client = getClient(params.botToken);
  await client.views.open({
    trigger_id: params.triggerId,
    view: {
      type: "modal",
      callback_id: "draft_edit_modal",
      private_metadata: String(params.draftId),
      title: { type: "plain_text", text: "Edit Reply" },
      submit: { type: "plain_text", text: "Send" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        {
          type: "input",
          block_id: "reply_text_block",
          label: { type: "plain_text", text: "Reply text" },
          element: {
            type: "plain_text_input",
            action_id: "reply_text",
            multiline: true,
            initial_value: params.currentText,
          },
        },
      ],
    },
  });
}

export async function postEphemeral(params: {
  channelId: string;
  userId: string;
  text: string;
  botToken?: string;
}): Promise<void> {
  if (!isSlackConfigured() && !params.botToken) {
    logger.warn("postEphemeral: Slack not configured, cannot post ephemeral message");
    return;
  }
  try {
    const client = getClient(params.botToken);
    await client.chat.postEphemeral({
      channel: params.channelId,
      user: params.userId,
      text: params.text,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to post ephemeral Slack message");
  }
}

export async function updateMessageAfterAction(
  channelId: string,
  ts: string,
  action: "sent" | "edited" | "discarded" | "send_failed",
  operatorName?: string,
  botToken?: string,
  errorDetail?: string,
  finalReplyText?: string,
): Promise<void> {
  if (!isSlackConfigured() && !botToken) return;

  const labels: Record<string, string> = {
    sent: "✅ Reply sent",
    edited: "✏️ Reply edited and sent",
    discarded: "🗑️ Draft discarded",
    send_failed: "❌ Send failed — reply was not delivered",
  };

  const byLine = operatorName ? ` by ${operatorName}` : "";
  const text = `${labels[action]}${byLine}`;
  const statusLine = action === "send_failed"
    ? `${labels[action]}${byLine}. ${errorDetail ? `Error: ${errorDetail}. ` : ""}The draft is still pending — retry from DraftFly.`
    : `${labels[action]}${byLine}. No further action needed.`;

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: statusLine },
    },
  ];

  // For edited/sent actions, append the final reply text so reviewers can see
  // exactly what was sent.
  if (finalReplyText && (action === "edited" || action === "sent")) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Sent reply:*\n${finalReplyText}` },
    });
  }

  try {
    const client = getClient(botToken);
    await client.chat.update({
      channel: channelId,
      ts,
      text,
      blocks,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to update Slack message after action");
  }
}
