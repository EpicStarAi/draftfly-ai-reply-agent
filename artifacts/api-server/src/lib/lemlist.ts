import { logger } from "./logger";
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
 * Express middleware that verifies incoming Lemlist webhook requests carry the
 * correct shared secret in the `X-Webhook-Secret` header.
 *
 * - If `LEMLIST_WEBHOOK_SECRET` is set: the header must match exactly; mismatches
 *   return 401 and the request is dropped.
 * - If `LEMLIST_WEBHOOK_SECRET` is not set: requests are rejected with 503 so the
 *   endpoint is disabled rather than open to anyone.
 */
export function requireWebhookSecret(req: ExpressRequest, res: ExpressResponse, next: NextFunction): void {
  const secret = process.env.LEMLIST_WEBHOOK_SECRET;

  if (!secret) {
    logger.error(
      { path: req.path },
      "LEMLIST_WEBHOOK_SECRET is not configured — webhook endpoint is disabled. Set this secret in Replit Secrets and add X-Webhook-Secret to your n8n HTTP Request node.",
    );
    res.status(503).json({
      ok: false,
      error: "Webhook endpoint is not configured. Set LEMLIST_WEBHOOK_SECRET in Replit Secrets.",
    });
    return;
  }

  const provided = req.headers["x-webhook-secret"];

  if (!provided || provided !== secret) {
    logger.warn(
      { path: req.path, hasHeader: !!provided },
      "Lemlist webhook rejected — missing or invalid X-Webhook-Secret",
    );
    res.status(401).json({ ok: false, error: "Unauthorized: invalid or missing webhook secret" });
    return;
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

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!isLemlistConfigured()) {
    return { ok: false, error: "LEMLIST_API_KEY is not configured" };
  }
  try {
    const res = await lemlistFetch("/campaigns?limit=1");
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${body}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Lemlist connection test failed");
    return { ok: false, error: msg };
  }
}

export async function getCampaigns(): Promise<LemlistCampaign[]> {
  if (!isLemlistConfigured()) {
    throw new Error("LEMLIST_API_KEY is not configured. Add it to Replit Secrets to fetch campaigns.");
  }
  const res = await lemlistFetch("/campaigns");
  if (!res.ok) throw new Error(`Lemlist API error: HTTP ${res.status}`);
  const data = await res.json() as { campaigns?: LemlistCampaign[] } | LemlistCampaign[];
  return Array.isArray(data) ? data : (data.campaigns ?? []);
}

export async function sendReply(params: {
  leadId: string;
  campaignId: string;
  replyText: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isLemlistConfigured()) {
    throw new Error("LEMLIST_API_KEY is not configured. Add it to Replit Secrets to send replies.");
  }
  const res = await lemlistFetch(`/campaigns/${params.campaignId}/leads/${params.leadId}/reply`, {
    method: "POST",
    body: JSON.stringify({ text: params.replyText }),
  });
  if (res.ok) return { ok: true };
  const body = await res.text();
  logger.error({ campaignId: params.campaignId, leadId: params.leadId }, `Lemlist sendReply failed: HTTP ${res.status}`);
  return { ok: false, error: `HTTP ${res.status}: ${body}` };
}
