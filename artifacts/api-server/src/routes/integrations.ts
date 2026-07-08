import { Router, type IRouter } from "express";
import { isSlackConfigured, getSlackStatus, postTestMessage } from "../lib/slack";
import { isLemlistConfigured, testConnection as testLemlist, getCampaigns } from "../lib/lemlist";
import { isClaudeConfigured, testConnection as testClaude } from "../lib/claude";

const router: IRouter = Router();

// GET /integrations/status — check all integrations
router.get("/integrations/status", async (_req, res): Promise<void> => {
  const slackStatus = getSlackStatus();
  const dbOk = !!process.env.DATABASE_URL;

  res.json({
    slack: {
      configured: slackStatus.configured,
      appId: slackStatus.appId,
      clientId: slackStatus.clientId,
      hasToken: !!process.env.SLACK_BOT_TOKEN,
      hasSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
    },
    lemlist: {
      configured: isLemlistConfigured(),
      hasApiKey: !!process.env.LEMLIST_API_KEY,
    },
    claude: {
      configured: isClaudeConfigured(),
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    },
    n8n: {
      configured: !!process.env.N8N_WEBHOOK_URL,
      webhookUrl: process.env.N8N_WEBHOOK_URL ?? null,
    },
    database: {
      configured: dbOk,
    },
    appBaseUrl: process.env.APP_BASE_URL ?? null,
  });
});

// POST /integrations/test/slack — test Slack connection
router.post("/integrations/test/slack", async (req, res): Promise<void> => {
  const channelId = (req.body as { channelId?: string }).channelId;
  if (!channelId) {
    res.status(400).json({ error: "channelId is required" });
    return;
  }
  const result = await postTestMessage(channelId);
  res.json(result);
});

// POST /integrations/test/lemlist — test Lemlist connection
router.post("/integrations/test/lemlist", async (_req, res): Promise<void> => {
  const result = await testLemlist();
  res.json(result);
});

// POST /integrations/test/claude — test Claude connection
router.post("/integrations/test/claude", async (_req, res): Promise<void> => {
  const result = await testClaude();
  res.json(result);
});

// POST /integrations/test/database — test DB connection
router.post("/integrations/test/database", async (_req, res): Promise<void> => {
  try {
    const { db } = await import("@workspace/db");
    await db.execute("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ ok: false, error: msg });
  }
});

// GET /integrations/lemlist/campaigns — list Lemlist campaigns
router.get("/integrations/lemlist/campaigns", async (_req, res): Promise<void> => {
  const campaigns = await getCampaigns();
  res.json({ campaigns, mock: !isLemlistConfigured() });
});

export default router;
