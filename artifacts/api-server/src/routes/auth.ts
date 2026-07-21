import { Router } from "express";
import { WebClient } from "@slack/web-api";
import { createHmac } from "crypto";
import { logger } from "../lib/logger";

declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      name: string;
      email: string;
      teamId: string;
      avatar?: string;
    };
    oauthState?: string;
  }
}

const router = Router();

function getRedirectUri(): string {
  const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "localhost:5000";
  return `https://${domain}/api/auth/slack/callback`;
}

router.get("/auth/slack", (req, res) => {
  const clientId = process.env["SLACK_CLIENT_ID"];
  if (!clientId) {
    res.status(503).json({ error: "Slack OAuth not configured (missing SLACK_CLIENT_ID)" });
    return;
  }

  const state = Math.random().toString(36).slice(2);
  req.session["oauthState"] = state;

  const params = new URLSearchParams({
    client_id: clientId,
    user_scope: "identity.basic,identity.email,identity.avatar",
    redirect_uri: getRedirectUri(),
    state,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

router.get("/auth/slack/callback", async (req, res) => {
  const clientId = process.env["SLACK_CLIENT_ID"];
  const clientSecret = process.env["SLACK_CLIENT_SECRET"];

  if (!clientId || !clientSecret) {
    res.status(503).send("Slack OAuth not configured");
    return;
  }

  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    logger.warn({ error }, "Slack OAuth denied by user");
    res.redirect("/app/login?error=denied");
    return;
  }

  if (state !== req.session["oauthState"]) {
    logger.warn("Slack OAuth state mismatch");
    res.redirect("/app/login?error=state");
    return;
  }

  try {
    const tokenResp = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getRedirectUri(),
      }),
    });

    const tokenData = (await tokenResp.json()) as {
      ok: boolean;
      authed_user?: { id: string; access_token: string };
      error?: string;
    };

    if (!tokenData.ok || !tokenData.authed_user?.access_token) {
      logger.error({ slackError: tokenData.error }, "Slack token exchange failed");
      res.redirect("/app/login?error=token");
      return;
    }

    const client = new WebClient(tokenData.authed_user.access_token);
    const identity = await client.users.identity({});

    if (!identity.ok || !identity.user) {
      logger.error("Failed to fetch Slack user identity");
      res.redirect("/app/login?error=identity");
      return;
    }

    req.session.user = {
      id: identity.user.id ?? tokenData.authed_user.id,
      name: identity.user.name ?? "Unknown",
      email: (identity.user as { email?: string }).email ?? "",
      teamId: identity.team?.id ?? "",
      avatar: (identity.user as { image_48?: string }).image_48,
    };

    delete req.session["oauthState"];

    logger.info({ userId: req.session.user.id }, "User logged in via Slack");
    res.redirect("/app");
  } catch (err) {
    logger.error({ err }, "Slack OAuth callback error");
    res.redirect("/app/login?error=server");
  }
});

router.get("/auth/me", (req, res) => {
  if (!req.session.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(req.session.user);
});

function devLoginEnabled(): boolean {
  return (
    process.env["NODE_ENV"] !== "production" &&
    process.env["ENABLE_DEV_LOGIN"] === "true"
  );
}

function safeRedirect(next: unknown): string {
  if (typeof next !== "string") return "/app";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/app";
  return trimmed;
}

router.post("/auth/dev-login", (req, res) => {
  if (!devLoginEnabled()) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  req.session.user = {
    id: "TEST_USER",
    name: "Test Operator",
    email: "test@draftfly.dev",
    teamId: "TEST_TEAM",
  };
  res.json({ ok: true });
});

router.get("/auth/dev-login", (req, res) => {
  if (!devLoginEnabled()) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  req.session.user = {
    id: "TEST_USER",
    name: "Test Operator",
    email: "test@draftfly.dev",
    teamId: "TEST_TEAM",
  };
  const redirect = safeRedirect(req.query["next"]);
  req.session.save(() => res.redirect(redirect));
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) logger.warn({ err }, "Session destroy error");
    res.json({ ok: true });
  });
});

router.post("/auth/telegram", (req, res) => {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  const allowedIds = process.env["ALLOWED_TELEGRAM_USER_IDS"] ?? "";

  if (!botToken) {
    res.status(503).json({ error: "Telegram bot token not configured" });
    return;
  }

  const { initData } = req.body as { initData?: string };

  if (!initData) {
    res.status(400).json({ error: "Missing initData" });
    return;
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) {
      res.status(401).json({ error: "Missing hash" });
      return;
    }

    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (computedHash !== hash) {
      logger.warn("Telegram initData hash mismatch");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const userStr = params.get("user");
    const user = userStr ? (JSON.parse(userStr) as { id?: number }) : null;
    const userId = user?.id?.toString() ?? "";

    const allowed = allowedIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(userId)) {
      logger.warn({ userId }, "Telegram user not in allowlist");
      res.status(403).json({ error: "Access denied" });
      return;
    }

    logger.info({ userId }, "Telegram user verified");
    res.json({ ok: true, userId });
  } catch (err) {
    logger.error({ err }, "Telegram auth error");
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
