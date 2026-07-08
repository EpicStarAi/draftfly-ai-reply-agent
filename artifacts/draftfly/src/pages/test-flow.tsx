import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play,
  CheckCircle2,
  Pencil,
  Trash2,
  Send,
  ChevronRight,
  MessageSquare,
  Zap,
  Bot,
  Hash,
  Clock,
  AlertTriangle,
  ArrowRight,
  User,
  Globe,
  FileText,
  Activity,
} from "lucide-react";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CLIENTS = [
  { id: "c1", name: "Axiom Sales", channel: "#axiom-replies", slackWorkspace: "Axiom HQ" },
  { id: "c2", name: "Northbridge Group", channel: "#northbridge-replies", slackWorkspace: "Northbridge" },
  { id: "c3", name: "Venture Scale", channel: "#venturescale-replies", slackWorkspace: "VentureScale" },
];

const MOCK_CAMPAIGNS = [
  { id: "camp1", clientId: "c1", name: "SaaS Founders Outreach Q3", personaId: "p1", lemlistId: "LEM-001" },
  { id: "camp2", clientId: "c1", name: "VP Sales Sequence — US/UK", personaId: "p2", lemlistId: "LEM-002" },
  { id: "camp3", clientId: "c2", name: "DACH Enterprise Expansion", personaId: "p3", lemlistId: "LEM-003" },
  { id: "camp4", clientId: "c3", name: "Middle East VC Warm Intro", personaId: "p4", lemlistId: "LEM-004" },
];

const MOCK_PERSONAS = [
  {
    id: "p1",
    name: "Senior SDR",
    tone: "Direct, data-driven, concise. Lead with value. No fluff.",
    product: "AI-powered B2B reply automation via Slack approval",
    cta: "15-minute discovery call",
    objections: ["Too expensive", "We already have a tool", "Need to check with team"],
    regionRules: {
      US: "Be direct. Reference ROI and time saved. Suggest call quickly.",
      UK: "Slightly warmer opener. Mention 'team efficiency'. Offer call or email follow-up.",
      DACH: "Formal German-style. Precise figures. No idioms. Offer detailed one-pager.",
      "Middle East": "Relationship-first. Reference trust and long-term partnership. No pressure close.",
    },
  },
  {
    id: "p2",
    name: "VP of Sales",
    tone: "Executive-level. Strategic framing. Short paragraphs. C-suite language.",
    product: "AI-powered B2B reply automation via Slack approval",
    cta: "30-minute strategy call",
    objections: ["Scaling risk", "Integration complexity", "Team adoption"],
    regionRules: {
      US: "Numbers-first. Pipeline impact framing. Be direct.",
      UK: "Professional tone. Acknowledge their scale. Offer tailored demo.",
      DACH: "Structured and precise. Reference compliance and process.",
      "Middle East": "Senior tone. Respect hierarchy. Reference references and partnerships.",
    },
  },
  {
    id: "p3",
    name: "DACH Enterprise SDR",
    tone: "Formal, structured, no colloquialisms. Reference precision, reliability, and process efficiency.",
    product: "AI-powered B2B reply automation via Slack approval",
    cta: "Technical demo or detailed one-pager",
    objections: ["Data privacy (GDPR)", "Process disruption", "Vendor lock-in"],
    regionRules: {
      DACH: "Open formally. Use full sentences. Reference GDPR compliance. Offer documentation.",
      US: "Slightly more relaxed but still structured. Reference data security.",
    },
  },
  {
    id: "p4",
    name: "Middle East Relationship Builder",
    tone: "Warm, respectful, trust-oriented. No hard close. Invite dialogue.",
    product: "AI-powered B2B reply automation via Slack approval",
    cta: "Introductory call to explore fit",
    objections: ["Not the right time", "Prefer referral", "Need internal buy-in"],
    regionRules: {
      "Middle East": "Open with appreciation. Emphasise trust and long-term value. No urgency language.",
      US: "Warmer than standard. Still relationship-focused but can be more direct.",
    },
  },
];

// ─── Draft generation (mock Claude) ──────────────────────────────────────────

function generateDraft(fields: FormFields, persona: typeof MOCK_PERSONAS[0]): string {
  const { leadName, leadCompany, leadRole, leadCountry, incomingReply } = fields;

  const regionKey = (["US", "UK", "DACH", "Middle East"].find((r) =>
    leadCountry.toUpperCase().includes(r.toUpperCase()) ||
    (r === "DACH" && ["germany", "austria", "switzerland", "de", "at", "ch"].some((k) => leadCountry.toLowerCase().includes(k))) ||
    (r === "Middle East" && ["uae", "saudi", "dubai", "riyadh", "qatar", "kuwait"].some((k) => leadCountry.toLowerCase().includes(k)))
  ) ?? "US") as keyof typeof persona.regionRules;

  const regionRule = persona.regionRules[regionKey] ?? persona.regionRules[Object.keys(persona.regionRules)[0] as keyof typeof persona.regionRules] ?? "";

  // Generate a contextual reply based on the incoming text
  const mentionedInterest = incomingReply.toLowerCase().includes("interest") || incomingReply.toLowerCase().includes("yes") || incomingReply.toLowerCase().includes("sure");
  const askedDetails = incomingReply.toLowerCase().includes("detail") || incomingReply.toLowerCase().includes("more") || incomingReply.toLowerCase().includes("info");
  const askedPricing = incomingReply.toLowerCase().includes("pric") || incomingReply.toLowerCase().includes("cost") || incomingReply.toLowerCase().includes("fee");
  const askedTiming = incomingReply.toLowerCase().includes("when") || incomingReply.toLowerCase().includes("time") || incomingReply.toLowerCase().includes("schedul");

  let opener = "";
  let body = "";
  let close = "";

  if (regionKey === "Middle East") {
    opener = `Hi ${leadName},\n\nThank you for getting back to me — I appreciate you taking the time.`;
  } else if (regionKey === "DACH") {
    opener = `Dear ${leadName},\n\nThank you for your response.`;
  } else if (regionKey === "UK") {
    opener = `Hi ${leadName},\n\nThanks for coming back to me — glad to hear from you.`;
  } else {
    opener = `Hi ${leadName},\n\nThanks for the quick reply!`;
  }

  if (askedPricing) {
    body = `Pricing depends on your team's outreach volume and the number of campaigns, but most teams in ${leadRole ? `${leadRole} roles` : "similar positions"} at ${leadCompany} start seeing value within the first week. I'd rather walk you through it in context than drop numbers without understanding your setup.`;
  } else if (askedDetails || mentionedInterest) {
    body = `Happy to share more on how this works. The core idea is simple: when a prospect replies to your Lemlist campaign, our system drafts a personalised follow-up using Claude and sends it to your team's Slack channel for a one-click approval before anything is sent. No more context-switching, no missed opportunities.`;
  } else if (askedTiming) {
    body = `I'm flexible this week — happy to work around your schedule. Even a 15-minute call would be enough to see if this makes sense for ${leadCompany}'s current workflow.`;
  } else {
    body = `Based on what you've shared, I think there's a real fit here — especially for a ${leadRole || "team"} at ${leadCompany} handling outbound at scale. The approval layer means your team stays in control without slowing down response times.`;
  }

  if (regionKey === "Middle East") {
    close = `\n\nWould you be open to a short introductory call to explore whether this could be a good fit for your team?\n\nLooking forward to the conversation.`;
  } else if (regionKey === "DACH") {
    close = `\n\nI would be happy to send you a detailed one-pager or schedule a technical walkthrough at your convenience.`;
  } else {
    close = `\n\nWould a ${persona.cta} work for you this week?`;
  }

  return `${opener}\n\n${body}${close}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormFields {
  clientId: string;
  campaignId: string;
  leadName: string;
  leadCompany: string;
  leadRole: string;
  leadCountry: string;
  incomingReply: string;
}

type FlowStep = "idle" | "webhook" | "campaign" | "persona" | "region" | "draft" | "slack" | "done";
type Decision = "send" | "edit" | "discard" | null;

interface LogEntry {
  ts: string;
  step: string;
  detail: string;
  ok: boolean;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS: { id: FlowStep; label: string }[] = [
  { id: "webhook", label: "Webhook" },
  { id: "campaign", label: "Campaign" },
  { id: "persona", label: "Persona" },
  { id: "region", label: "Region" },
  { id: "draft", label: "Draft" },
  { id: "slack", label: "Slack" },
  { id: "done", label: "Done" },
];

const STEP_ORDER: FlowStep[] = ["idle", "webhook", "campaign", "persona", "region", "draft", "slack", "done"];

function stepIndex(s: FlowStep) {
  return STEP_ORDER.indexOf(s);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TestFlow() {
  const [fields, setFields] = useState<FormFields>({
    clientId: "c1",
    campaignId: "camp1",
    leadName: "Sarah Mitchell",
    leadCompany: "Momentum Labs",
    leadRole: "VP of Sales",
    leadCountry: "US",
    incomingReply: "Yes, interested. Can you send more details?",
  });

  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<FlowStep>("idle");
  const [draft, setDraft] = useState<string | null>(null);
  const [persona, setPersona] = useState<typeof MOCK_PERSONAS[0] | null>(null);
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [editedDraft, setEditedDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const client = MOCK_CLIENTS.find((c) => c.id === fields.clientId);
  const campaign = MOCK_CAMPAIGNS.find((c) => c.id === fields.campaignId);
  const availableCampaigns = MOCK_CAMPAIGNS.filter((c) => c.clientId === fields.clientId);

  function now() {
    return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function addLog(step: string, detail: string, ok = true) {
    setLogs((prev) => [...prev, { ts: now(), step, detail, ok }]);
  }

  async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function runFlow() {
    if (running) return;
    setRunning(true);
    setCurrentStep("idle");
    setDraft(null);
    setPersona(null);
    setRegionKey(null);
    setDecision(null);
    setLogs([]);
    setEditedDraft(null);
    setEditing(false);

    const camp = MOCK_CAMPAIGNS.find((c) => c.id === fields.campaignId);
    const p = MOCK_PERSONAS.find((p) => p.id === camp?.personaId) ?? MOCK_PERSONAS[0];

    // Step 1: Webhook received
    setCurrentStep("webhook");
    await sleep(600);
    addLog("Lemlist Webhook", `POST /webhook/lemlist — reply from ${fields.leadName} <${fields.leadName.toLowerCase().replace(" ", ".")}@${fields.leadCompany.toLowerCase().replace(" ", "")}.io>`, true);

    // Step 2: Campaign detection
    setCurrentStep("campaign");
    await sleep(700);
    addLog("Campaign Detection", `Matched campaign "${camp?.name}" (${camp?.lemlistId}) from lemlistCampaignId in payload`, true);

    // Step 3: Persona selection
    setCurrentStep("persona");
    await sleep(600);
    setPersona(p);
    addLog("Persona Lookup", `Selected persona "${p.name}" linked to campaign ${camp?.name}`, true);

    // Step 4: Regional tone
    setCurrentStep("region");
    await sleep(500);
    const rk = (["US", "UK", "DACH", "Middle East"].find((r) =>
      fields.leadCountry.toUpperCase().includes(r.toUpperCase()) ||
      (r === "DACH" && ["germany", "austria", "switzerland", "de", "at", "ch"].some((k) => fields.leadCountry.toLowerCase().includes(k))) ||
      (r === "Middle East" && ["uae", "saudi", "dubai", "riyadh", "qatar", "kuwait"].some((k) => fields.leadCountry.toLowerCase().includes(k)))
    ) ?? "US");
    setRegionKey(rk);
    addLog("Regional Tone", `Country "${fields.leadCountry}" → region bucket "${rk}" — applied tone rules`, true);

    // Step 5: Claude draft
    setCurrentStep("draft");
    await sleep(1200);
    const generated = generateDraft(fields, p);
    setDraft(generated);
    addLog("Claude Draft", `claude-3-5-sonnet — draft generated (${generated.length} chars, ~${Math.round(generated.split(" ").length * 1.3)} tokens)`, true);

    // Step 6: Slack approval
    setCurrentStep("slack");
    await sleep(500);
    addLog("Slack Post", `Draft card posted to ${client?.channel ?? "#channel"} in ${client?.slackWorkspace ?? "workspace"}`, true);

    setRunning(false);
  }

  function handleDecision(d: Decision) {
    if (decision) return;
    setDecision(d);
    setCurrentStep("done");
    if (d === "send") {
      addLog("Approval Decision", `✅ SEND — operator approved draft. Payload dispatched to Lemlist for delivery.`, true);
      addLog("Lemlist Delivery", `Mock POST /send — reply queued for ${fields.leadName} at ${fields.leadCompany}. Status: delivered (mock).`, true);
    } else if (d === "edit") {
      addLog("Approval Decision", `✏️ EDIT — operator opened edit modal in Slack. Awaiting revised draft.`, true);
      setEditing(true);
      setEditedDraft(draft);
    } else {
      addLog("Approval Decision", `🗑️ DISCARD — draft discarded. No message sent. Lead status: no reply.`, false);
    }
  }

  function handleSendEdited() {
    setEditing(false);
    addLog("Edited Draft Sent", `Operator revised and approved draft. Payload dispatched to Lemlist (mock).`, true);
  }

  const currentStepIndex = stepIndex(currentStep);
  const isComplete = currentStep === "done" || (currentStep === "slack" && !running);
  const showResults = currentStepIndex >= stepIndex("draft") && draft;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-title">Test Flow</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate the full beta pipeline end-to-end without any real API calls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-mono text-[10px] tracking-wider">MOCK TEST ONLY</Badge>
          <Badge className="bg-muted text-muted-foreground border-border font-mono text-[10px] tracking-wider">NO REAL MESSAGE SENT</Badge>
          <Badge className="bg-primary/10 text-primary border-primary/20 font-mono text-[10px] tracking-wider">DRAFT MODE</Badge>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[10px] tracking-wider">HUMAN APPROVAL FLOW</Badge>
        </div>
      </div>

      {/* Technical explanation */}
      <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2.5">
        <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
        <p>
          <span className="font-medium text-foreground">Production flow: </span>
          Lemlist webhook &rarr; campaign / persona mapping &rarr; Claude draft &rarr; Slack approval card &rarr; operator decision &rarr; Lemlist send.
          This test runs all stages in sequence using mock data and a local draft generator — no external APIs are called.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">
        {/* LEFT — Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Test Parameters
              </CardTitle>
              <CardDescription>Configure the simulated incoming reply</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Client</Label>
                <Select
                  value={fields.clientId}
                  onValueChange={(v) => {
                    const first = MOCK_CAMPAIGNS.find((c) => c.clientId === v);
                    setFields((f) => ({ ...f, clientId: v, campaignId: first?.id ?? "" }));
                  }}
                >
                  <SelectTrigger data-testid="select-client">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_CLIENTS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campaign */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Campaign</Label>
                <Select
                  value={fields.campaignId}
                  onValueChange={(v) => setFields((f) => ({ ...f, campaignId: v }))}
                >
                  <SelectTrigger data-testid="select-campaign">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {campaign && (
                  <p className="text-[10px] text-muted-foreground font-mono">Lemlist ID: {campaign.lemlistId}</p>
                )}
              </div>

              <Separator />

              {/* Lead fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <User className="h-3 w-3" /> Lead Name
                  </Label>
                  <Input
                    value={fields.leadName}
                    onChange={(e) => setFields((f) => ({ ...f, leadName: e.target.value }))}
                    className="text-sm"
                    data-testid="input-lead-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Company</Label>
                  <Input
                    value={fields.leadCompany}
                    onChange={(e) => setFields((f) => ({ ...f, leadCompany: e.target.value }))}
                    className="text-sm"
                    data-testid="input-lead-company"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Role</Label>
                  <Input
                    value={fields.leadRole}
                    onChange={(e) => setFields((f) => ({ ...f, leadRole: e.target.value }))}
                    className="text-sm"
                    data-testid="input-lead-role"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Country / Region
                  </Label>
                  <Input
                    value={fields.leadCountry}
                    onChange={(e) => setFields((f) => ({ ...f, leadCountry: e.target.value }))}
                    className="text-sm"
                    placeholder="US, UK, Germany, UAE…"
                    data-testid="input-lead-country"
                  />
                </div>
              </div>

              {/* Incoming reply */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Incoming Reply Text</Label>
                <Textarea
                  value={fields.incomingReply}
                  onChange={(e) => setFields((f) => ({ ...f, incomingReply: e.target.value }))}
                  rows={3}
                  className="text-sm resize-none"
                  placeholder="Paste the lead's reply here…"
                  data-testid="input-incoming-reply"
                />
              </div>

              <Button
                onClick={runFlow}
                disabled={running || !fields.clientId || !fields.campaignId || !fields.leadName || !fields.incomingReply}
                className="w-full gap-2 font-semibold"
                data-testid="button-run-flow"
              >
                <Play className={`h-4 w-4 ${running ? "animate-pulse" : ""}`} />
                {running ? "Running…" : "Run Test Flow"}
              </Button>
            </CardContent>
          </Card>

          {/* Flow Steps tracker */}
          {currentStep !== "idle" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Pipeline Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pb-4">
                {STEPS.map((s, i) => {
                  const idx = stepIndex(s.id);
                  const active = currentStep === s.id;
                  const done = currentStepIndex > idx;
                  return (
                    <div key={s.id} className="flex items-center gap-2.5 text-xs py-0.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        done ? "bg-emerald-500/20 text-emerald-400" :
                        active ? "bg-primary/20 text-primary ring-1 ring-primary/40" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {done ? <CheckCircle2 className="h-3 w-3" /> :
                         active ? <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> :
                         <span className="text-[10px] font-bold">{i + 1}</span>}
                      </div>
                      <span className={`font-medium ${done ? "text-emerald-400" : active ? "text-primary" : "text-muted-foreground"}`}>
                        {s.label}
                      </span>
                      {active && running && (
                        <span className="text-muted-foreground animate-pulse">processing…</span>
                      )}
                      {done && (
                        <span className="text-emerald-400 ml-auto">✓</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT — Results */}
        <div className="space-y-5">
          {currentStep === "idle" && (
            <div className="h-full min-h-64 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/10">
              <div className="text-center space-y-2 px-6">
                <Play className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">Configure the test parameters and click <span className="font-medium text-foreground">Run Test Flow</span> to simulate the pipeline.</p>
              </div>
            </div>
          )}

          {currentStep !== "idle" && (
            <>
              {/* Persona card */}
              {persona && (
                <Card className="border-primary/20 bg-primary/5" data-testid="result-persona">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Selected Persona — <span className="text-primary">{persona.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div>
                      <span className="text-muted-foreground uppercase tracking-wider">Tone: </span>
                      <span className="text-foreground">{persona.tone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase tracking-wider">CTA: </span>
                      <span className="text-foreground">{persona.cta}</span>
                    </div>
                    {regionKey && persona.regionRules[regionKey as keyof typeof persona.regionRules] && (
                      <div className="rounded-md bg-background/60 border border-border px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Globe className="h-3 w-3 text-primary" />
                          <span className="font-medium text-foreground text-[10px] uppercase tracking-wider">Applied Region Rule — {regionKey}</span>
                        </div>
                        <p className="text-muted-foreground">{persona.regionRules[regionKey as keyof typeof persona.regionRules]}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground uppercase tracking-wider">Common objections handled: </span>
                      <span className="text-foreground">{persona.objections.join(", ")}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Generated draft */}
              {showResults && !editing && (
                <Card data-testid="result-draft">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" /> Claude Draft
                      </CardTitle>
                      <Badge className="bg-primary/10 text-primary border-primary/20 font-mono text-[10px]">claude-3-5-sonnet (mock)</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans bg-muted/30 border border-border rounded-md p-3">
                      {draft}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Edit mode */}
              {editing && (
                <Card className="border-primary/30" data-testid="result-edit">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-primary" /> Edit Draft
                    </CardTitle>
                    <CardDescription>Revise the draft before sending</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={editedDraft ?? ""}
                      onChange={(e) => setEditedDraft(e.target.value)}
                      rows={10}
                      className="font-sans text-xs resize-none"
                      data-testid="textarea-edit-draft"
                    />
                    <Button size="sm" className="gap-2" onClick={handleSendEdited} data-testid="button-send-edited">
                      <Send className="h-3.5 w-3.5" /> Send Edited Draft
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Slack approval card */}
              {currentStepIndex >= stepIndex("slack") && draft && !decision && (
                <Card data-testid="result-slack-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" /> Slack Approval Card
                    </CardTitle>
                    <CardDescription>
                      This card is posted to {client?.channel} — operator clicks to decide
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Slack-style mockup */}
                    <div className="bg-[#1A1D21] border border-[#272A2E] rounded-lg p-4 text-[13px] space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0">
                          <MessageSquare className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-[#D1D2D3]">DraftFly</span>
                          <span className="bg-[#2C3136] text-[#ABABAD] text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">App</span>
                          <span className="text-xs text-[#7E7E7E]">{now()}</span>
                        </div>
                      </div>

                      <p className="text-[#D1D2D3] font-semibold">
                        New reply from <span className="text-[#6366F1]">{fields.leadName}</span> — {fields.leadCompany}
                      </p>

                      <div className="border-l-[3px] border-[#3F4147] pl-3">
                        <p className="text-[#ABABAD] italic">"{fields.incomingReply}"</p>
                      </div>

                      <div className="bg-[#222529] border border-[#35373B] rounded-md p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#ABABAD]">Claude Draft</span>
                        </div>
                        <pre className="text-[#D1D2D3] text-[12px] leading-relaxed font-sans whitespace-pre-wrap">{draft}</pre>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#7E7E7E]">
                        <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {campaign?.name}</span>
                        <span>&middot;</span>
                        <span>Persona: {persona?.name}</span>
                        <span>&middot;</span>
                        <span>{regionKey}</span>
                      </div>

                      <Separator className="bg-[#35373B]" />

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleDecision("send")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-[#007A5A] hover:bg-[#148567] text-white transition-colors"
                          data-testid="slack-button-send"
                        >
                          <Send className="h-3.5 w-3.5" /> ✅ Send Reply
                        </button>
                        <button
                          onClick={() => handleDecision("edit")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border bg-[#222529] border-[#35373B] text-[#D1D2D3] hover:bg-[#2C3136] transition-colors"
                          data-testid="slack-button-edit"
                        >
                          <Pencil className="h-3.5 w-3.5" /> ✏️ Edit Reply
                        </button>
                        <button
                          onClick={() => handleDecision("discard")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border bg-[#222529] border-[#35373B] text-[#E01E5A] hover:bg-[#2C3136] transition-colors"
                          data-testid="slack-button-discard"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> 🗑️ Discard
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Final status */}
              {decision && !editing && (
                <Card className={`border-2 ${decision === "send" ? "border-emerald-500/30 bg-emerald-500/5" : decision === "edit" ? "border-primary/30 bg-primary/5" : "border-red-500/20 bg-red-500/5"}`} data-testid="result-final-status">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-start gap-3">
                      {decision === "send" && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
                      {decision === "edit" && <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
                      {decision === "discard" && <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-semibold text-sm">
                          {decision === "send" && "Reply sent — flow complete"}
                          {decision === "edit" && "Edited draft sent — flow complete"}
                          {decision === "discard" && "Draft discarded — no reply sent"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {decision === "send" && `Mock payload dispatched to Lemlist for delivery to ${fields.leadName} at ${fields.leadCompany}. In production this triggers a Lemlist API call.`}
                          {decision === "edit" && `Revised draft approved and dispatched to Lemlist (mock). In production the operator edits in Slack and the n8n workflow submits the revision.`}
                          {decision === "discard" && `No action taken on the lead reply. In production this closes the draft and logs a "discarded" status.`}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge className="bg-muted text-muted-foreground border-border font-mono text-[10px]">MOCK TEST ONLY</Badge>
                          <Badge className="bg-muted text-muted-foreground border-border font-mono text-[10px]">NO REAL MESSAGE SENT</Badge>
                          {decision !== "discard" && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono text-[10px]">HUMAN APPROVED</Badge>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Activity logs */}
              {logs.length > 0 && (
                <Card data-testid="result-logs">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" /> Activity Log
                    </CardTitle>
                    <CardDescription>Step-by-step execution trace</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border">
                      {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-3 px-4 py-2.5 text-xs" data-testid={`log-entry-${i}`}>
                          <span className="font-mono text-muted-foreground shrink-0 flex items-center gap-1 pt-0.5">
                            <Clock className="h-3 w-3" /> {log.ts}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground/80">{log.step}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className={`ml-auto shrink-0 font-mono font-medium ${log.ok ? "text-emerald-400" : "text-red-400"}`}>
                                {log.ok ? "ok" : "err"}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-0.5 break-words">{log.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
