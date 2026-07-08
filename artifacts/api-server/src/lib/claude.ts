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

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DraftParams {
  // Lead context
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  leadRole?: string;
  leadCountry?: string;
  incomingReply: string;
  conversationHistory?: string;

  // Persona
  personaName: string;
  productDescription: string;
  toneOfVoice: string;
  commonObjections?: string;
  cta: string;
  qualificationRules?: string;
  regionRules?: string;

  // Campaign
  replyRules?: string;
}

export interface DraftResult {
  draft: string;
  confidenceScore: number;
  detectedIntent: string;
  suggestedNextAction: string;
  mock?: boolean;
}

// ─── Draft generation ──────────────────────────────────────────────────────

export async function generateDraftReply(params: DraftParams): Promise<DraftResult> {
  if (!isClaudeConfigured()) {
    logger.warn("ANTHROPIC_API_KEY not set — returning mock draft");
    return generateMockDraft(params);
  }

  const systemPrompt = buildSystemPrompt(params);
  const userMessage = buildUserMessage(params);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = response.content.find((b) => b.type === "text")?.text ?? "";

    // Try to parse structured JSON response
    try {
      const parsed = JSON.parse(raw) as {
        draft?: string;
        confidence_score?: number;
        detected_intent?: string;
        suggested_next_action?: string;
      };
      return {
        draft: parsed.draft ?? raw,
        confidenceScore: parsed.confidence_score ?? 0.8,
        detectedIntent: parsed.detected_intent ?? "interest",
        suggestedNextAction: parsed.suggested_next_action ?? "schedule_call",
      };
    } catch {
      // Plain text fallback
      return {
        draft: raw,
        confidenceScore: 0.75,
        detectedIntent: "interest",
        suggestedNextAction: "schedule_call",
      };
    }
  } catch (err) {
    logger.error({ err }, "Claude draft generation failed — using mock fallback");
    return generateMockDraft(params);
  }
}

export async function testConnection(): Promise<{ ok: boolean; tokens?: number; error?: string; mock?: boolean }> {
  if (!isClaudeConfigured()) {
    return { ok: true, mock: true };
  }
  try {
    const client = getClient();
    const res = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
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
  "detected_intent": "<interest|objection|pricing|timing|referral|not_interested|unclear>",
  "suggested_next_action": "<schedule_call|send_info|handle_objection|discard|follow_up>"
}

Rules:
- Write the draft as a natural, conversational message (no subject line, no greeting prefix "Hi [Name]," — start directly)
- Match the persona tone precisely
- Keep it concise — under 150 words
- Never mention AI or automation
- Never fabricate pricing or specific metrics
- The draft should feel like it was written personally by the sender`;
}

function buildUserMessage(p: DraftParams): string {
  return `Lead: ${p.leadName} (${p.leadRole ?? "unknown role"}) at ${p.leadCompany}${p.leadCountry ? `, ${p.leadCountry}` : ""}
Email: ${p.leadEmail}
${p.conversationHistory ? `Conversation so far:\n${p.conversationHistory}\n` : ""}
Their latest reply: "${p.incomingReply}"

Generate the reply draft.`;
}

// ─── Mock fallback ─────────────────────────────────────────────────────────

function generateMockDraft(p: DraftParams): DraftResult {
  const reply = p.incomingReply.toLowerCase();
  const interest = reply.includes("interest") || reply.includes("yes") || reply.includes("sure") || reply.includes("ok");
  const pricing = reply.includes("pric") || reply.includes("cost");
  const timing = reply.includes("when") || reply.includes("time");

  let intent: string;
  let draft: string;
  let nextAction: string;

  if (pricing) {
    intent = "pricing";
    draft = `Hi ${p.leadName},\n\nThanks for asking — pricing depends on your team's outreach volume and which channels you're using. Rather than give you a number without context, I'd prefer to walk you through it in a quick call where I can understand your setup properly. Would 15 minutes this week work for you?`;
    nextAction = "schedule_call";
  } else if (timing) {
    intent = "timing";
    draft = `Hi ${p.leadName},\n\nHappy to work around your schedule. Even a 15-minute intro call would be enough to see whether this makes sense for ${p.leadCompany}. What does next week look like for you?`;
    nextAction = "schedule_call";
  } else if (interest) {
    intent = "interest";
    draft = `Hi ${p.leadName},\n\nGlad to hear that — happy to share more. The short version: when a prospect replies to your campaign, our system drafts a personalised follow-up using AI and sends it to your Slack channel for a one-click approval before anything goes out. No context-switching, no missed opportunities.\n\nWould a ${p.cta} make sense this week?`;
    nextAction = "schedule_call";
  } else {
    intent = "unclear";
    draft = `Hi ${p.leadName},\n\nThanks for getting back to me. Based on what you've shared, I think there could be a real fit for ${p.leadCompany}. Would it make sense to jump on a quick ${p.cta} to explore whether this is the right time?`;
    nextAction = "schedule_call";
  }

  return {
    draft,
    confidenceScore: interest ? 0.88 : pricing ? 0.82 : 0.71,
    detectedIntent: intent,
    suggestedNextAction: nextAction,
    mock: true,
  };
}
