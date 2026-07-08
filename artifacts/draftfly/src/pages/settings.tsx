import { useState } from "react";
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
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ConnectionStatus = "connected" | "warning" | "disconnected";

interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: ConnectionStatus;
  credentialLabel: string;
  credentialValue: string;
  lastTested: string;
  lastResult: string;
  lastResultOk: boolean;
  note?: string;
}

const integrations: IntegrationConfig[] = [
  {
    id: "lemlist",
    name: "Lemlist API",
    description: "Campaign webhooks, conversation history, and reply delivery",
    icon: Link2,
    status: "connected",
    credentialLabel: "API Key",
    credentialValue: "lem_api_placeholder_xxxxxxxxxxxx",
    lastTested: "2 min ago",
    lastResult: "200 OK — campaigns listed successfully",
    lastResultOk: true,
  },
  {
    id: "slack",
    name: "Slack App",
    description: "Bot token for posting drafts and receiving block_action callbacks",
    icon: MessageSquare,
    status: "connected",
    credentialLabel: "Bot Token",
    credentialValue: "xoxb-mock-bot-token-placeholder-0000000",
    lastTested: "4 min ago",
    lastResult: "auth.test passed — bot identity verified",
    lastResultOk: true,
  },
  {
    id: "claude",
    name: "Claude API",
    description: "Anthropic claude-3-5-sonnet for AI reply generation",
    icon: Bot,
    status: "connected",
    credentialLabel: "API Key",
    credentialValue: "sk-ant-placeholder-xxxxxxxxxxxxxxxxxxxx",
    lastTested: "8 min ago",
    lastResult: "Completion test passed — 74 tokens, 11ms",
    lastResultOk: true,
  },
  {
    id: "n8n",
    name: "n8n Webhook",
    description: "Self-hosted n8n orchestration layer on Hetzner VPS behind Caddy",
    icon: Zap,
    status: "warning",
    credentialLabel: "Webhook Base URL",
    credentialValue: "https://n8n.draftfly.internal",
    lastTested: "12 min ago",
    lastResult: "Response time 4200ms — above 3000ms threshold",
    lastResultOk: false,
    note: "High latency detected. Check n8n instance load and Caddy proxy settings.",
  },
  {
    id: "database",
    name: "Database / Config Layer",
    description: "PostgreSQL — clients, campaigns, personas, drafts, logs",
    icon: Database,
    status: "connected",
    credentialLabel: "Connection String",
    credentialValue: "postgresql://user:••••••@localhost:5432/draftfly",
    lastTested: "1 min ago",
    lastResult: "Query latency 4ms — all tables reachable",
    lastResultOk: true,
  },
];

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
  return (
    <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted font-normal gap-1 shrink-0">
      <XCircle className="h-3 w-3" /> Disconnected
    </Badge>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationConfig }) {
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);

  function handleTest() {
    setTesting(true);
    setTested(false);
    setTimeout(() => {
      setTesting(false);
      setTested(true);
    }, 1400);
  }

  const Icon = integration.icon;

  return (
    <Card data-testid={`integration-card-${integration.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{integration.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{integration.description}</CardDescription>
            </div>
          </div>
          <StatusBadge status={integration.status} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Credential field */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">{integration.credentialLabel}</Label>
          <div className="relative">
            <Input
              value={show ? integration.credentialValue : integration.credentialValue.replace(/[^:@./\s-]/g, "•")}
              readOnly
              className="font-mono text-xs pr-10 bg-background/60 border-border"
              data-testid={`input-cred-${integration.id}`}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              data-testid={`toggle-cred-${integration.id}`}
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Warning note */}
        {integration.note && (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>{integration.note}</p>
          </div>
        )}

        <Separator />

        {/* Last test result + test button */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Last tested: {integration.lastTested}</p>
            <p className={`text-xs font-mono mt-0.5 truncate ${tested ? (integration.lastResultOk ? "text-emerald-400" : "text-amber-400") : integration.lastResultOk ? "text-emerald-400" : "text-amber-400"}`}>
              {tested
                ? (integration.lastResultOk ? integration.lastResult : integration.lastResult)
                : integration.lastResult}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="shrink-0 text-xs h-7"
            data-testid={`button-test-${integration.id}`}
          >
            <RefreshCw className={`h-3 w-3 mr-1.5 ${testing ? "animate-spin" : ""}`} />
            {testing ? "Testing…" : tested ? "Re-test" : "Test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
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
              <Input value="v0.2.0" disabled className="bg-muted/50 font-mono text-xs" data-testid="input-api-version" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Environment</Label>
              <Input value="Beta" disabled className="bg-muted/50 text-xs" data-testid="input-environment" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Release</Label>
              <Input value="MVP — Draft Mode only" disabled className="bg-muted/50 text-xs" data-testid="input-release" />
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
                <SelectTrigger data-testid="select-default-mode">
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
              <Input value="Disabled for all beta clients" disabled className="bg-muted/50 text-xs" data-testid="input-auto-mode" />
            </div>
          </div>
          <div className="rounded-md bg-muted/20 border border-border px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
            <div>
              <span className="text-foreground font-medium">Draft Mode is default and recommended for MVP. </span>
              Every AI-generated reply requires operator approval via Slack before it is sent to the prospect. Auto Mode will be enabled selectively once quality benchmarks are met.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Cards */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-semibold">Integration Status</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Placeholder credentials only. No real API keys are stored in this prototype.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
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
