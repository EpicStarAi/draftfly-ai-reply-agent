import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Database,
  Bot,
  Zap,
  MessageSquare,
  Link2,
  Shield,
  Loader2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ConnectionStatus = "connected" | "warning" | "disconnected" | "unconfigured";

interface ServerIntegrationStatus {
  slack: { configured: boolean; hasToken: boolean; hasSigningSecret: boolean; appId: string | null };
  lemlist: { configured: boolean; hasApiKey: boolean };
  claude: { configured: boolean; hasApiKey: boolean };
  n8n: { configured: boolean; webhookUrl: string | null };
  database: { configured: boolean };
  appBaseUrl: string | null;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchStatus(): Promise<ServerIntegrationStatus | null> {
  try {
    const res = await fetch(`${BASE}/api/integrations/status`);
    if (!res.ok) return null;
    return (await res.json()) as ServerIntegrationStatus;
  } catch {
    return null;
  }
}

async function testService(service: string, body?: Record<string, unknown>): Promise<{ ok: boolean; error?: string; mock?: boolean; tokens?: number }> {
  try {
    const res = await fetch(`${BASE}/api/integrations/test/${service}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return (await res.json()) as { ok: boolean; error?: string; mock?: boolean; tokens?: number };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

function statusFromServer(configured: boolean): ConnectionStatus {
  return configured ? "connected" : "unconfigured";
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") return (
    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 font-normal gap-1 shrink-0">
      <CheckCircle2 className="h-3 w-3" /> Connected
    </Badge>
  );
  if (status === "warning") return (
    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/10 font-normal gap-1 shrink-0">
      <AlertTriangle className="h-3 w-3" /> Warning
    </Badge>
  );
  if (status === "unconfigured") return (
    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/10 font-normal gap-1 shrink-0">
      <AlertTriangle className="h-3 w-3" /> Not Configured
    </Badge>
  );
  return (
    <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted font-normal gap-1 shrink-0">
      <XCircle className="h-3 w-3" /> Disconnected
    </Badge>
  );
}

interface CardConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  credentialLabel: string;
  credentialPlaceholder: string;
  secretEnvVar: string;
  testFn: () => Promise<{ ok: boolean; error?: string; mock?: boolean; tokens?: number }>;
}

function IntegrationCard({
  config,
  status,
}: {
  config: CardConfig;
  status: ConnectionStatus;
}) {
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; mock?: boolean; tokens?: number; ts?: string } | null>(null);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const result = await config.testFn();
    setTesting(false);
    setTestResult(result);
  }

  const Icon = config.icon;
  const effectiveStatus: ConnectionStatus = testResult
    ? testResult.ok ? "connected" : "warning"
    : status;

  return (
    <Card data-testid={`integration-card-${config.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{config.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{config.description}</CardDescription>
            </div>
          </div>
          <StatusBadge status={effectiveStatus} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Env var name */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">{config.credentialLabel}</Label>
          <div className="relative">
            <Input
              value={show ? config.secretEnvVar : config.credentialPlaceholder}
              readOnly
              className="font-mono text-xs pr-10 bg-background/60 border-border"
              data-testid={`input-cred-${config.id}`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">Set via Replit Secrets: <span className="text-foreground">{config.secretEnvVar}</span></p>
        </div>

        {/* Warning when not configured */}
        {status === "unconfigured" && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>Secret not set. Add <span className="font-mono">{config.secretEnvVar}</span> in Replit Secrets to enable this integration. Mock mode active.</p>
          </div>
        )}

        <Separator />

        {/* Test result */}
        {testResult && (
          <div className={`rounded-md px-3 py-2 text-xs border ${testResult.ok ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"}`}>
            {testResult.ok ? (
              <span>
                {testResult.mock ? "✓ Mock test passed (no secret configured)" : "✓ Connection verified"}
                {testResult.tokens != null ? ` — ${testResult.tokens} tokens used` : ""}
              </span>
            ) : (
              <span>✗ {testResult.error ?? "Connection failed"}</span>
            )}
          </div>
        )}

        {/* Test button */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="text-xs h-7"
            data-testid={`button-test-${config.id}`}
          >
            {testing ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
            {testing ? "Testing…" : testResult ? "Re-test" : "Test Connection"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [serverStatus, setServerStatus] = useState<ServerIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus().then((s) => {
      setServerStatus(s);
      setLoading(false);
    });
  }, []);

  const cards: CardConfig[] = [
    {
      id: "lemlist",
      name: "Lemlist API",
      description: "Campaign webhooks, conversation history, and reply delivery",
      icon: Link2,
      credentialLabel: "API Key",
      credentialPlaceholder: "lem_api_••••••••••••••••••••••••••••",
      secretEnvVar: "LEMLIST_API_KEY",
      testFn: () => testService("lemlist"),
    },
    {
      id: "slack",
      name: "Slack App",
      description: "Bot token for posting drafts and handling block_action callbacks",
      icon: MessageSquare,
      credentialLabel: "Bot Token",
      credentialPlaceholder: "xoxb-••••••••••••••••••••••••••••••",
      secretEnvVar: "SLACK_BOT_TOKEN",
      testFn: () => testService("slack", { channelId: "C0000000000" }),
    },
    {
      id: "claude",
      name: "Claude API (Anthropic)",
      description: "claude-3-5-sonnet for AI reply draft generation",
      icon: Bot,
      credentialLabel: "API Key",
      credentialPlaceholder: "sk-ant-••••••••••••••••••••••••••••••",
      secretEnvVar: "ANTHROPIC_API_KEY",
      testFn: () => testService("claude"),
    },
    {
      id: "n8n",
      name: "n8n Webhook",
      description: "Self-hosted n8n orchestration layer — Lemlist → Claude → Slack pipeline",
      icon: Zap,
      credentialLabel: "Webhook Base URL",
      credentialPlaceholder: "https://n8n.your-domain.internal",
      secretEnvVar: "N8N_WEBHOOK_URL",
      testFn: async () => {
        const url = serverStatus?.n8n?.webhookUrl;
        if (!url) return { ok: true, mock: true };
        try {
          const res = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(5000) });
          return { ok: res.ok };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Unreachable" };
        }
      },
    },
    {
      id: "database",
      name: "Database / Config Layer",
      description: "PostgreSQL — clients, campaigns, personas, drafts, logs",
      icon: Database,
      credentialLabel: "Connection String",
      credentialPlaceholder: "postgresql://user:••••••@host:5432/draftfly",
      secretEnvVar: "DATABASE_URL",
      testFn: () => testService("database"),
    },
  ];

  function statusFor(id: string): ConnectionStatus {
    if (!serverStatus) return "unconfigured";
    switch (id) {
      case "lemlist": return statusFromServer(serverStatus.lemlist.configured);
      case "slack": return statusFromServer(serverStatus.slack.configured);
      case "claude": return statusFromServer(serverStatus.claude.configured);
      case "n8n": return statusFromServer(serverStatus.n8n.configured);
      case "database": return statusFromServer(serverStatus.database.configured);
      default: return "unconfigured";
    }
  }

  const configuredCount = serverStatus
    ? [serverStatus.slack.configured, serverStatus.lemlist.configured, serverStatus.claude.configured, serverStatus.database.configured].filter(Boolean).length
    : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global configuration, operating mode defaults, and integration connection status.
        </p>
      </div>

      {/* General */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Version</Label>
              <Input value="v0.2.0" disabled className="bg-muted/50 font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Environment</Label>
              <Input value="Beta" disabled className="bg-muted/50 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">App Base URL</Label>
              <Input
                value={serverStatus?.appBaseUrl ?? (loading ? "Loading…" : "Not configured")}
                disabled
                className="bg-muted/50 font-mono text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operating Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Operating Mode Defaults</CardTitle>
          <CardDescription>Applied to all new client accounts. Can be overridden per client.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Default Client Mode</Label>
              <Select defaultValue="draft" disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft — Manual Slack approval</SelectItem>
                  <SelectItem value="auto">Auto — Direct send (disabled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Auto Mode</Label>
              <Input value="Disabled for all beta clients" disabled className="bg-muted/50 text-xs" />
            </div>
          </div>
          <div className="rounded-md bg-muted/20 border border-border px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
            <div>
              <span className="text-foreground font-medium">Draft Mode is default and required for beta. </span>
              Every AI-generated reply requires operator approval via Slack before it is sent. Auto Mode will be enabled per-client once quality benchmarks are confirmed.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Cards */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Integration Status</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Loading status from server…" : `${configuredCount}/4 integrations configured via Replit Secrets`}
            </p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* Setup instructions */}
        {!loading && configuredCount < 4 && (
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2.5">
            <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground mb-1">To activate real integrations:</p>
              <ol className="space-y-0.5 list-decimal list-inside">
                <li>Open <span className="font-medium text-foreground">Replit Secrets</span> (lock icon in the sidebar)</li>
                <li>Add each secret key listed on the integration cards below</li>
                <li>Restart the API server workflow to pick up the new secrets</li>
                <li>Click <span className="font-medium text-foreground">Test Connection</span> to verify</li>
              </ol>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => (
            <IntegrationCard key={card.id} config={card} status={statusFor(card.id)} />
          ))}
        </div>
      </div>

      {/* LinkedIn note */}
      <div className="rounded-md border border-border bg-muted/20 px-4 py-3 flex items-start gap-3 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-medium text-foreground">LinkedIn integration not available. </span>
          LinkedIn does not provide a public API for direct message automation. DraftFly connects to Lemlist, which handles both email and LinkedIn outreach campaign delivery.
        </div>
      </div>
    </div>
  );
}
