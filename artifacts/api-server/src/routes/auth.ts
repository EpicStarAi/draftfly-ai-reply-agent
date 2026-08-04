import { Router } from "express";
import { createHmac, randomBytes } from "crypto";
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
    oauthNonce?: string;
  }
}

const router = Router();

function getRedirectUri(): string {
  // Prefer APP_BASE_URL (production domain) over REPLIT_DOMAINS (dev *.replit.dev domain)
  const base =
    process.env["APP_BASE_URL"] ??
    `https://${process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "localhost:5000"}`;
  return `${base.replace(/\/$/, "")}/api/auth/slack/callback`;
}

// Sign in with Slack uses Slack's OpenID Connect flow. The legacy identity.*
// user scopes are no longer granted to new Slack apps, so oauth/v2/authorize
// with user_scope=identity.basic fails with invalid_scope at Slack's consent
// screen. OIDC (scope: openid profile email) is the supported replacement.
router.get("/auth/slack", (req, res) => {
  const clientId = process.env["SLACK_CLIENT_ID"];
  if (!clientId) {
    logger.error("SLACK_CLIENT_ID not configured — cannot initiate Slack OAuth");
    res.redirect("/app/login?error=config");
    return;
  }

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  req.session["oauthState"] = state;
  req.session["oauthNonce"] = nonce;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "openid profile email",
    redirect_uri: getRedirectUri(),
    state,
    nonce,
  });

  // Explicitly save session before redirecting so oauthState is persisted
  // to the DB before Slack sends the callback (eliminates save-race condition)
  req.session.save((err) => {
    if (err) {
      logger.error({ err }, "Failed to save session before Slack OAuth redirect");
      res.redirect("/app/login?error=server");
      return;
    }
    res.redirect(`https://slack.com/openid/connect/authorize?${params}`);
  });
});

interface SlackIdTokenClaims {
  sub?: string;
  nonce?: string;
  name?: string;
  email?: string;
  picture?: string;
  "https://slack.com/user_id"?: string;
  "https://slack.com/team_id"?: string;
  "https://slack.com/user_image_48"?: string;
}

function decodeIdToken(idToken: string): SlackIdTokenClaims | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SlackIdTokenClaims;
  } catch {
    return null;
  }
}

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

  if (!state || state !== req.session["oauthState"]) {
    logger.warn("Slack OAuth state mismatch");
    res.redirect("/app/login?error=state");
    return;
  }

  try {
    const tokenResp = await fetch("https://slack.com/api/openid.connect.token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getRedirectUri(),
      }),
    });

    const tokenData = (await tokenResp.json()) as {
      ok: boolean;
      id_token?: string;
      error?: string;
    };

    if (!tokenData.ok || !tokenData.id_token) {
      logger.error({ slackError: tokenData.error }, "Slack token exchange failed");
      res.redirect("/app/login?error=token");
      return;
    }

    // The id_token comes straight from Slack's token endpoint over TLS, so
    // decoding without signature verification is safe; nonce is still checked.
    const claims = decodeIdToken(tokenData.id_token);
    if (!claims) {
      logger.error("Failed to decode Slack id_token");
      res.redirect("/app/login?error=identity");
      return;
    }

    if (!claims.nonce || claims.nonce !== req.session["oauthNonce"]) {
      logger.warn("Slack OAuth nonce mismatch");
      res.redirect("/app/login?error=state");
      return;
    }

    const userId = claims["https://slack.com/user_id"] ?? claims.sub;
    if (!userId) {
      logger.error("Slack id_token missing user id");
      res.redirect("/app/login?error=identity");
      return;
    }

    req.session.user = {
      id: userId,
      name: claims.name ?? "Unknown",
      email: claims.email ?? "",
      teamId: claims["https://slack.com/team_id"] ?? "",
      avatar: claims["https://slack.com/user_image_48"] ?? claims.picture,
    };

    delete req.session["oauthState"];
    delete req.session["oauthNonce"];

    logger.info({ userId }, "User logged in via Slack");

    // Save before redirecting: express-session persists asynchronously at
    // response end, so without an explicit save the browser can hit
    // /api/auth/me before the session row exists and bounce back to /login.
    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error({ err: saveErr }, "Failed to save session after Slack login");
        res.redirect("/app/login?error=server");
        return;
      }
      res.redirect("/app");
    });
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
