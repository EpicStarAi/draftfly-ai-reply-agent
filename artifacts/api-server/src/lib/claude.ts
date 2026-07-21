import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";

// ─── Configuration ─────────────────────────────────────────────────────────

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// ─── Draft validation ──────────────────────────────────────────────────────

/** Minimum character length for a draft to be considered a real reply. */
export const MIN_DRAFT_LENGTH = 10;

/**
 * Returns true when `text` is long enough to be a genuine AI-generated reply.
 * Rejects empty strings, whitespace-only strings, and very short outputs that
 * are almost certainly a refusal, parse error, or incomplete generation.
 */
export function isValidDraftText(text: string): boolean {
  return text.trim().length > MIN_DRAFT_LENGTH;
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DraftParams {
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  leadRole?: string;
  leadCountry?: string;
  incomingReply: string;
  conversationHistory?: string;

  personaName: string;
  productDescription: string;
  toneOfVoice: string;
  commonObjections?: string;
  cta: string;
  qualificationRules?: string;
  regionRules?: string;

  replyRules?: string;
}

export interface DraftResult {
  draft: string;
  confidenceScore: number;
  detectedIntent: string;
  suggestedNextAction: string;
}

// ─── Draft generation ──────────────────────────────────────────────────────

export async function generateDraftReply(params: DraftParams): Promise<DraftResult> {
  if (!isClaudeConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not configured. Add it to Replit Secrets to enable AI draft generation.");
  }

  const systemPrompt = buildSystemPrompt(params);
  const userMessage = buildUserMessage(params);

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content.find((b) => b.type === "text")?.text ?? "";

  // Strip markdown code block wrapper if Claude returned ```json {...} ```
  const codeBlockMatch = raw.trim().match(/^```(?:json)?\s*([\s\S]*?)```$/);
  const jsonCandidate = codeBlockMatch ? codeBlockMatch[1].trim() : raw.trim();

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      draft?: string;
      confidence_score?: number;
      detected_intent?: string;
      suggested_next_action?: string;
    };
    return {
      draft: parsed.draft ?? jsonCandidate,
      confidenceScore: parsed.confidence_score ?? 0.8,
      detectedIntent: parsed.detected_intent ?? "interest",
      suggestedNextAction: parsed.suggested_next_action ?? "schedule_call",
    };
  } catch {
    return {
      draft: jsonCandidate,
      confidenceScore: 0.75,
      detectedIntent: "interest",
      suggestedNextAction: "schedule_call",
    };
  }
}

export async function testConnection(): Promise<{ ok: boolean; tokens?: number; error?: string }> {
  if (!isClaudeConfigured()) {
    return { ok: false, error: "ANTHROPIC_API_KEY is not configured" };
  }
  try {
    const client = getClient();
    const res = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 10,
      messages: [{ role: "user", content: "Reply with the word: ready" }],
    });
    const tokens = res.usage.input_tokens + res.usage.output_tokens;
    return { ok: true, tokens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Claude connection test failed");
    return { ok: false, error: msg };
  }
}

// ─── Prompt builders ───────────────────────────────────────────────────────

function buildSystemPrompt(p: DraftParams): string {
  return `You are a B2B sales reply assistant operating as the "${p.personaName}" persona.

Product: ${p.productDescription}
Tone of voice: ${p.toneOfVoice}
Primary CTA: ${p.cta}
${p.commonObjections ? `Common objections to handle: ${p.commonObjections}` : ""}
${p.regionRules ? `Regional tone rules: ${p.regionRules}` : ""}
${p.replyRules ? `Campaign reply rules: ${p.replyRules}` : ""}
${p.qualificationRules ? `Qualification criteria: ${p.qualificationRules}` : ""}

You must respond with a JSON object in this exact format:
{
  "draft": "<the reply email/message body>",
  "confidence_score": <0.0-1.0>,
  "detected_intent": "<interest|objection|pricing|timing|referral|not_interested|unsubscribe|complaint|unclear>",
  "suggested_next_action": "<schedule_call|send_info|handle_objection|discard|follow_up|escalate>"
}

Rules:
- Write the draft as a natural, conversational message (no subject line, no greeting prefix "Hi [Name]," — start directly)
- Match the persona tone precisely
- Keep it concise — under 150 words
- Never mention AI or automation
- Never fabricate pricing or specific metrics — if pricing is asked and no approved rates are available, set suggested_next_action to "escalate" and write a draft that says a manager will follow up with pricing
- The draft should feel like it was written personally by the sender
- If detected_intent is "unsubscribe": set draft to a brief polite acknowledgement (e.g. "Understood — removing you from our list. All the best."), set suggested_next_action to "discard", confidence_score to 0.99
- If detected_intent is "complaint": set suggested_next_action to "escalate", set confidence_score below 0.5, draft should be a neutral acknowledgement only — no promises, no specifics
- If the message is rude, aggressive, or contains offensive language: set suggested_next_action to "escalate"`;
}

function buildUserMessage(p: DraftParams): string {
  return `Lead: ${p.leadName} (${p.leadRole ?? "unknown role"}) at ${p.leadCompany}${p.leadCountry ? `, ${p.leadCountry}` : ""}
Email: ${p.leadEmail}
${p.conversationHistory ? `Conversation so far:\n${p.conversationHistory}\n` : ""}
Their latest reply: "${p.incomingReply}"

Generate the reply draft.`;
}
