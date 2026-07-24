import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
// No background sender, sweeper, cron or queue is started here — by design.
// The auto-sweep that used to run on a timer has been removed entirely
// (see lib/staleDraftSweeper.ts). The only thing that can move a draft to a
// lead is approveAndSend(), and it only runs from a verified Slack/Telegram
// approval click.
import { assertApprovalRequired } from "./lib/approvalGate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe backfill complete"))
      .catch((err) => logger.error({ err }, "Stripe backfill error"));
  } catch (err) {
    logger.warn({ err }, "Stripe initialization skipped — integration not connected");
  }
}

// Fail fast at boot if the approval gate is not active. In production this can
// never be switched off; elsewhere it surfaces a misconfigured environment
// before a single webhook is accepted.
assertApprovalRequired();
logger.info(
  { approvalRequired: true, nodeEnv: process.env.NODE_ENV },
  "Approval gate active — replies can only be dispatched via approveAndSend()",
);

await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
