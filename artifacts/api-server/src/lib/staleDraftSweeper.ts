/**
 * Stale draft NOTIFIER (formerly the auto-sweeper).
 *
 * History: this module used to run on a `setInterval` and automatically move
 * any draft that had been pending past a threshold into `send_failed` — that is
 * the origin of the "Send failed — draft pending 15 min threshold" messages seen
 * in Slack. It never dispatched a reply, but it *did* mutate approval-relevant
 * state on a timer, and a `send_failed` draft is a retryable draft.
 *
 * What it does now:
 *   - reports stale pending drafts to Slack so an operator notices them
 *   - changes NOTHING: no status writes, no approval writes, no Lemlist calls
 *   - has no scheduler; it only runs when a human invokes it
 *
 * Hard rules for this file:
 *   - It must never import `approveAndSend`, `sendReply`, or any Lemlist module.
 *   - It must never write to draftsTable.
 * Both are asserted by staleDraftNotifier.test.ts and sendPathExclusivity.test.ts.
 */

import { WebClient } from "@slack/web-api";
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db, draftsTable, clientsTable, campaignsTable } from "@workspace/db";
import { logger } from "./logger";
import { isSlackConfigured } from "./slack";

// ─── Configuration ──────────────────────────────────────────────────────────

// Drafts whose Slack approval card was posted successfully but nobody acted:
// default 24 hours. Override with STALE_DRAFT_THRESHOLD_MINUTES.
const DEFAULT_THRESHOLD_MINUTES = 1440;

// Drafts where the Slack card never posted (slackMessageTs is null):
// surfaced sooner. Override with STALE_ORPHAN_THRESHOLD_MINUTES.
const DEFAULT_ORPHAN_THRESHOLD_MINUTES = 60;

function getThresholdMinutes(): number {
  const raw = process.env.STALE_DRAFT_THRESHOLD_MINUTES;
  if (!raw) return DEFAULT_THRESHOLD_MINUTES;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn({ raw }, "staleDraftNotifier: invalid STALE_DRAFT_THRESHOLD_MINUTES — using default 1440");
    return DEFAULT_THRESHOLD_MINUTES;
  }
  return parsed;
}

function getOrphanThresholdMinutes(): number {
  const raw = process.env.STALE_ORPHAN_THRESHOLD_MINUTES;
  if (!raw) return DEFAULT_ORPHAN_THRESHOLD_MINUTES;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn({ raw }, "staleDraftNotifier: invalid STALE_ORPHAN_THRESHOLD_MINUTES — using default 60");
    return DEFAULT_ORPHAN_THRESHOLD_MINUTES;
  }
  return parsed;
}

export interface StaleDraftReport {
  draftId: number;
  ageMinutes: number;
  prospectEmail: string;
  prospectName: string;
  clientName?: string;
  campaignName?: string;
  cardPosted: boolean;
}

// ─── Read-only scan ─────────────────────────────────────────────────────────

/**
 * Find pending drafts that have gone stale. Read-only: this function issues no
 * writes of any kind.
 */
export async function findStaleDrafts(): Promise<StaleDraftReport[]> {
  const thresholdMinutes = getThresholdMinutes();
  const orphanThresholdMinutes = getOrphanThresholdMinutes();
  const postedCutoff = new Date(Date.now() - thresholdMinutes * 60 * 1000);
  const orphanCutoff = new Date(Date.now() - orphanThresholdMinutes * 60 * 1000);

  const staleDrafts = await db
    .select({
      id: draftsTable.id,
      clientId: draftsTable.clientId,
      campaignId: draftsTable.campaignId,
      prospectEmail: draftsTable.prospectEmail,
      prospectName: draftsTable.prospectName,
      slackMessageTs: draftsTable.slackMessageTs,
      createdAt: draftsTable.createdAt,
    })
    .from(draftsTable)
    .where(
      and(
        eq(draftsTable.status, "pending"),
        or(
          and(isNotNull(draftsTable.slackMessageTs), lt(draftsTable.createdAt, postedCutoff)),
          and(isNull(draftsTable.slackMessageTs), lt(draftsTable.createdAt, orphanCutoff)),
        ),
      ),
    );

  const reports: StaleDraftReport[] = [];
  for (const draft of staleDrafts) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, draft.clientId));
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));
    reports.push({
      draftId: draft.id,
      ageMinutes: Math.round((Date.now() - draft.createdAt.getTime()) / 60_000),
      prospectEmail: draft.prospectEmail,
      prospectName: draft.prospectName,
      clientName: client?.name ?? undefined,
      campaignName: campaign?.name ?? undefined,
      cardPosted: !!draft.slackMessageTs,
    });
  }
  return reports;
}

// ─── Notify-only pass ───────────────────────────────────────────────────────

/**
 * Report stale pending drafts to SLACK_ALERT_CHANNEL.
 *
 * Explicitly does NOT: change draft status, set or clear approval, update the
 * approval card, or dispatch anything to Lemlist. A stale draft stays `pending`
 * and remains approvable by an operator — which is the whole point.
 *
 * Invoke manually (ops script / admin endpoint). Nothing schedules it.
 */
export async function notifyStaleDrafts(): Promise<StaleDraftReport[]> {
  const stale = await findStaleDrafts();

  if (stale.length === 0) {
    logger.debug("staleDraftNotifier: no stale drafts found");
    return [];
  }

  logger.warn({ count: stale.length }, "staleDraftNotifier: found stale pending drafts (no action taken)");

  const alertChannel = process.env.SLACK_ALERT_CHANNEL;
  if (!alertChannel || !isSlackConfigured()) {
    logger.info("staleDraftNotifier: SLACK_ALERT_CHANNEL not configured — reporting to logs only");
    return stale;
  }

  const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
  for (const draft of stale) {
    try {
      await slackClient.chat.postMessage({
        channel: alertChannel,
        text: `⏳ Draft #${draft.draftId} is still awaiting approval (${draft.prospectName} / ${draft.prospectEmail})`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `⏳ *Draft still awaiting approval*`,
                `*Draft:* #${draft.draftId}`,
                `*Lead:* ${draft.prospectName} (${draft.prospectEmail})`,
                `*Client:* ${draft.clientName ?? "unknown"}`,
                `*Campaign:* ${draft.campaignName ?? "unknown"}`,
                `*Waiting:* ${draft.ageMinutes} minutes`,
                draft.cardPosted
                  ? ``
                  : `⚠️ The approval card was never posted — use *Repost card* in DraftFly.`,
                ``,
                `_No action has been taken. The draft is unchanged and can still be approved._`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          },
        ],
      });
    } catch (err) {
      logger.warn({ err, draftId: draft.draftId }, "staleDraftNotifier: failed to post alert");
    }
  }

  return stale;
}

// ─── Scheduler: removed ─────────────────────────────────────────────────────
//
// `startStaleDraftSweeper()` used to return a `setInterval` handle here. It has
// been deleted, not disabled: there is no timer, cron, queue or worker in this
// service that can act on a draft. Approval is the only thing that moves a
// draft forward, and approval only comes from a verified Slack/Telegram click.
//
// If a scheduled reminder is wanted later, schedule `notifyStaleDrafts()` — it
// is structurally incapable of sending, because `sendReply()` demands a
// capability token that only `approveAndSend()` can mint.
