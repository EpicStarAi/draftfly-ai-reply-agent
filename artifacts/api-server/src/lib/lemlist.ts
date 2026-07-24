import { timingSafeEqual } from "node:crypto";
import { logger } from "./logger";
import { assertSendAuthorization, type SendAuthorization } from "./sendAuthorization";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction,
} from "express";

// ─── Configuration ─────────────────────────────────────────────────────────

export function isLemlistConfigured(): boolean {
  return !!process.env.LEMLIST_API_KEY;
}

export function isWebhookSecretConfigured(): boolean {
  return !!process.env.LEMLIST_WEBHOOK_SECRET;
}

/**
 * Whether the legacy `?secret=` query-string credential is still accepted.
 *
 * TEMPORARY compatibility shim. Lemlist's outgoing webhooks did not support
 * custom headers when this integration was built, so the secret lived in the
 * URL — where it lands in access logs, proxy logs and browser history.
 *
 * Default: enabled, so updating this service does not break the currently
 * registered production webhook. Once the Lemlist webhook is re-registered with
 * a header credential, set ALLOW_QUERY_WEBHOOK_SECRET=false and then delete the
 * query branch below entirely.
 */
export function isQuerySecretAllowed(): boolean {
  return process.env.ALLOW_QUERY_WEBHOOK_SECRET !== "false";
}

/** Constant-time comparison that does not leak length through early return. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Still burn a comparison so timing does not distinguish "wrong length"
    // from "wrong value".
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function readHeader(req: ExpressRequest, name: string): string | undefined {
  const raw = req.headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Express middleware that verifies incoming Lemlist webhook requests carry the
 * correct shared secret.
 *
 * Accepted sources, in priority order:
 *   1. `Authorization: Bearer <secret>`      ← preferred
 *   2. `X-DraftFly-Signature: <secret>`      ← preferred
 *   3. `X-Webhook-Secret: <secret>`          ← existing n8n path
 *   4. `?secret=<secret>`                    ← legacy, behind ALLOW_QUERY_WEBHOOK_SECRET
 *
 * - If `LEMLIST_WEBHOOK_SECRET` is not set the endpoint is disabled (503) rather
 *   than open to anyone.
 * - Mismatches return 401 and the request is dropped.
 */
export function requireWebhookSecret(req: ExpressRequest, res: ExpressResponse, next: NextFunction): void {
  const secret = process.env.LEMLIST_WEBHOOK_SECRET;

  if (!secret) {
    logger.error(
      { path: req.path },
      "LEMLIST_WEBHOOK_SECRET is not configured — webhook endpoint is disabled.",
    );
    res.status(503).json({
      ok: false,
      error: "Webhook endpoint is not configured. Set LEMLIST_WEBHOOK_SECRET in Replit Secrets.",
    });
    return;
  }

  const authHeader = readHeader(req, "authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : undefined;
  const signature = readHeader(req, "x-draftfly-signature");
  const legacyHeader = readHeader(req, "x-webhook-secret");

  const queryRaw = req.query["secret"];
  const queryValue = typeof queryRaw === "string" ? queryRaw : undefined;
  const queryAllowed = isQuerySecretAllowed();
  const fromQuery = queryAllowed ? queryValue : undefined;

  const provided = bearer ?? signature ?? legacyHeader ?? fromQuery;
  const source = bearer
    ? "authorization-bearer"
    : signature
      ? "x-draftfly-signature"
      : legacyHeader
        ? "x-webhook-secret"
        : fromQuery
          ? "query"
          : "none";

  if (!provided || !secretsMatch(provided, secret)) {
    logger.warn(
      {
        path: req.path,
        source,
        queryPresentButDisabled: !!queryValue && !queryAllowed,
      },
      "Lemlist webhook rejected — missing or invalid secret",
    );
    res.status(401).json({ ok: false, error: "Unauthorized: invalid or missing webhook secret" });
    return;
  }

  if (source === "query") {
    logger.warn(
      { path: req.path },
      "Lemlist webhook authenticated via the deprecated ?secret= query parameter. " +
        "Re-register the webhook with an Authorization or X-DraftFly-Signature header, " +
        "then set ALLOW_QUERY_WEBHOOK_SECRET=false.",
    );
  }

  next();
}

function getApiKey(): string {
  const key = process.env.LEMLIST_API_KEY;
  if (!key) throw new Error("LEMLIST_API_KEY is not configured. Add it to Replit Secrets to enable Lemlist integration.");
  return key;
}

const LEMLIST_BASE = "https://api.lemlist.com/api";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LemlistCampaign {
  _id: string;
  name: string;
  status: string;
  sendingSchedule?: unknown;
}

export interface LemlistWebhookPayload {
  type: string;
  campaignId: string;
  leadId?: string;
  leadEmail?: string;
  leadFirstName?: string;
  leadLastName?: string;
  leadCompanyName?: string;
  country?: string;
  jobTitle?: string;
  replyText?: string;
  text?: string;
  [key: string]: unknown;
}

// ─── API calls ──────────────────────────────────────────────────────────────

async function lemlistFetch(path: string, options?: RequestInit): Promise<Response> {
  const key = getApiKey();
  const auth = Buffer.from(`any:${key}`).toString("base64");
  return fetch(`${LEMLIST_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
}

export const TEST_CONNECTION_TIMEOUT_MS = 10_000;
export const GET_CAMPAIGNS_TIMEOUT_MS = 15_000;

export async function testConnection(opts?: {
  /** Override the default 10 s timeout — useful in tests. */
  timeoutMs?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isLemlistConfigured()) {
    return { ok: false, error: "LEMLIST_API_KEY is not configured" };
  }
  const timeoutMs = opts?.timeoutMs ?? TEST_CONNECTION_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await lemlistFetch("/campaigns?limit=1", { signal: controller.signal });
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${body}` };
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      logger.error({ timeoutMs }, "Lemlist testConnection timed out — no response within the allowed window");
      return { ok: false, error: "timeout" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Lemlist connection test failed");
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function getCampaigns(opts?: {
  /** Override the default 15 s timeout — useful in tests. */
  timeoutMs?: number;
}): Promise<LemlistCampaign[]> {
  if (!isLemlistConfigured()) {
    throw new Error("LEMLIST_API_KEY is not configured. Add it to Replit Secrets to fetch campaigns.");
  }
  const timeoutMs = opts?.timeoutMs ?? GET_CAMPAIGNS_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await lemlistFetch("/campaigns", { signal: controller.signal });
    if (!res.ok) throw new Error(`Lemlist API error: HTTP ${res.status}`);
    const data = await res.json() as { campaigns?: LemlistCampaign[] } | LemlistCampaign[];
    return Array.isArray(data) ? data : (data.campaigns ?? []);
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      logger.error({ timeoutMs }, "Lemlist getCampaigns timed out — no response within the allowed window");
      throw new Error("timeout");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const SEND_REPLY_TIMEOUT_MS = 30_000;

/**
 * Dispatch a reply to a lead via Lemlist.
 *
 * ⚠️ This is the ONLY function in the codebase that puts a reply in front of a
 * lead. It cannot be called directly: it requires a `SendAuthorization`
 * capability token, and `approveAndSend()` is the only module able to mint one.
 * Do not add another caller — add it to approveAndSend() instead.
 *
 * @param authorization capability token proving a human approved this draft
 */
export async function sendReply(
  params: {
    leadId: string;
    campaignId: string;
    replyText: string;
    /** Override the default 30 s timeout — useful in tests. */
    timeoutMs?: number;
    /** Draft this send belongs to — checked against the authorization scope. */
    draftId: number;
  },
  authorization: SendAuthorization,
): Promise<{ ok: boolean; error?: string }> {
  // Approval gate, restated at the transport layer. Even if every check above
  // were bypassed, an unauthorized send stops here.
  assertSendAuthorization(authorization, params.draftId);

  if (!isLemlistConfigured()) {
    throw new Error("LEMLIST_API_KEY is not configured. Add it to Replit Secrets to send replies.");
  }

  const timeoutMs = params.timeoutMs ?? SEND_REPLY_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await lemlistFetch(`/campaigns/${params.campaignId}/leads/${params.leadId}/reply`, {
      method: "POST",
      body: JSON.stringify({ text: params.replyText }),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    const body = await res.text();
    logger.error({ campaignId: params.campaignId, leadId: params.leadId }, `Lemlist sendReply failed: HTTP ${res.status}`);
    return { ok: false, error: `HTTP ${res.status}: ${body}` };
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      logger.error(
        { campaignId: params.campaignId, leadId: params.leadId, timeoutMs },
        "Lemlist sendReply timed out — no response within the allowed window",
      );
      return { ok: false, error: "timeout" };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
