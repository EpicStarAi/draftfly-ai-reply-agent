import { logger } from "./logger";

// ─── Configuration ─────────────────────────────────────────────────────────

export function isLemlistConfigured(): boolean {
  return !!process.env.LEMLIST_API_KEY;
}

function getApiKey(): string {
  const key = process.env.LEMLIST_API_KEY;
  if (!key) throw new Error("LEMLIST_API_KEY not configured");
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
  // raw passthrough
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

export async function testConnection(): Promise<{ ok: boolean; error?: string; mock?: boolean }> {
  if (!isLemlistConfigured()) {
    return { ok: true, mock: true };
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
    return MOCK_CAMPAIGNS;
  }
  try {
    const res = await lemlistFetch("/campaigns");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { campaigns?: LemlistCampaign[] } | LemlistCampaign[];
    return Array.isArray(data) ? data : (data.campaigns ?? []);
  } catch (err) {
    logger.error({ err }, "Failed to fetch Lemlist campaigns");
    return MOCK_CAMPAIGNS;
  }
}

export async function sendReply(params: {
  leadId: string;
  campaignId: string;
  replyText: string;
}): Promise<{ ok: boolean; error?: string; mock?: boolean }> {
  if (!isLemlistConfigured()) {
    logger.info({ leadId: params.leadId }, "Lemlist not configured — mock send");
    return { ok: true, mock: true };
  }
  try {
    const res = await lemlistFetch(`/campaigns/${params.campaignId}/leads/${params.leadId}/reply`, {
      method: "POST",
      body: JSON.stringify({ text: params.replyText }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${body}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Lemlist sendReply failed");
    return { ok: false, error: msg };
  }
}

// ─── Mock data fallback ────────────────────────────────────────────────────

const MOCK_CAMPAIGNS: LemlistCampaign[] = [
  { _id: "LEM-001", name: "SaaS Founders Outreach Q3", status: "active" },
  { _id: "LEM-002", name: "VP Sales Sequence — US/UK", status: "active" },
  { _id: "LEM-003", name: "DACH Enterprise Expansion", status: "active" },
  { _id: "LEM-004", name: "Middle East VC Warm Intro", status: "paused" },
];
