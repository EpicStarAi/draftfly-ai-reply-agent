import { useGetDashboardStats, useListPendingDrafts, useListActivity } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Users,
  Activity,
  Inbox,
  CheckCircle2,
  Megaphone,
  ArrowRight,
  AlertTriangle,
  FlaskConical,
  Zap,
  Bot,
  MessageSquare,
  Database,
  Link2,
  XCircle,
  Settings,
  Loader2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface IntegrationStatus {
  slack: { configured: boolean };
  lemlist: { configured: boolean };
  claude: { configured: boolean };
  n8n: { configured: boolean };
  database: { configured: boolean };
}

// ─── Integration status hook ──────────────────────────────────────────────────

function useIntegrationStatus() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/integrations/status`)
      .then((r) => r.json() as Promise<IntegrationStatus>)
      .then((s) => { setStatus(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const anyConfigured =
    status?.lemlist.configured ||
    status?.slack.configured ||
    status?.claude.configured;

  return { status, loading, isDemo: !anyConfigured };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: pendingDrafts, isLoading: draftsLoading } = useListPendingDrafts();
  const { data: activity, isLoading: activityLoading } = useListActivity({ limit: 10 });
  const { status: integrations, loading: intLoading, isDemo } = useIntegrationStatus();

  const loading = statsLoading || intLoading;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live overview of your automated reply operations.
        </p>
      </div>

      {/* Demo Mode Banner */}
      {!intLoading && isDemo && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Demo Mode Active — no real integrations connected
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Metrics and activity below reflect demo data only. Add secrets in{" "}
              <Link href="/settings" className="underline font-medium">Settings → Integration Status</Link>{" "}
              to see real pipeline data.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 text-[10px] font-mono tracking-wider shrink-0">
              DEMO DATA ONLY
            </Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href="/settings">
                <Settings className="h-3 w-3 mr-1" /> Configure
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Connected banner */}
      {!intLoading && !isDemo && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300 flex-1">
            <span className="font-semibold">Real integrations active.</span>{" "}
            Data below reflects your live pipeline.
          </p>
          <Badge className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 text-[10px] font-mono tracking-wider shrink-0">
            REAL DATA
          </Badge>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Clients"
          value={stats?.totalClients}
          icon={Users}
          loading={loading}
          isDemo={isDemo}
          emptyLabel="No clients yet"
        />
        <KpiCard
          title="Active Campaigns"
          value={stats?.activeCampaigns}
          icon={Megaphone}
          loading={loading}
          isDemo={isDemo}
          emptyLabel="No campaigns yet"
        />
        <KpiCard
          title="Pending Drafts"
          value={stats?.pendingDrafts}
          icon={Inbox}
          loading={loading}
          isDemo={isDemo}
          alert={!isDemo && !!stats?.pendingDrafts && stats.pendingDrafts > 0}
          emptyLabel="No pending drafts"
        />
        <KpiCard
          title="Total Sent"
          value={stats?.totalDraftsSent}
          icon={CheckCircle2}
          loading={loading}
          isDemo={isDemo}
          emptyLabel="No replies sent yet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Workflow Status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Workflow Status</CardTitle>
                {isDemo && (
                  <Badge className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 text-[10px] font-mono">
                    NOT CONNECTED
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Step chain */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 sm:gap-0">
                <WorkflowStep
                  name="Lemlist"
                  icon={Link2}
                  connected={integrations?.lemlist.configured}
                  loading={intLoading}
                  description="Webhook source"
                />
                <ChainArrow />
                <WorkflowStep
                  name="n8n"
                  icon={Zap}
                  connected={integrations?.n8n.configured}
                  loading={intLoading}
                  description="Orchestration"
                />
                <ChainArrow />
                <WorkflowStep
                  name="Claude"
                  icon={Bot}
                  connected={integrations?.claude.configured}
                  loading={intLoading}
                  description="AI draft"
                />
                <ChainArrow />
                <WorkflowStep
                  name="Slack"
                  icon={MessageSquare}
                  connected={integrations?.slack.configured}
                  loading={intLoading}
                  description="Operator approval"
                />
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-4 text-center text-sm pt-1">
                <div>
                  <div className="font-semibold text-xl">
                    {isDemo ? <span className="text-muted-foreground/60">—</span> : (stats?.webhooksToday ?? 0)}
                  </div>
                  <div className="text-muted-foreground text-xs">Webhooks Today</div>
                </div>
                <div>
                  <div className="font-semibold text-xl">
                    {isDemo ? <span className="text-muted-foreground/60">—</span> : `${stats?.successRate ?? 0}%`}
                  </div>
                  <div className="text-muted-foreground text-xs">Success Rate</div>
                </div>
                <div>
                  <div className="font-semibold text-xl">
                    {isDemo ? <span className="text-muted-foreground/60">—</span> : (stats?.totalDraftsDiscarded ?? 0)}
                  </div>
                  <div className="text-muted-foreground text-xs">Discarded</div>
                </div>
              </div>

              {/* Setup nudge */}
              {isDemo && !intLoading && (
                <div className="rounded-md bg-muted/30 border border-border px-3 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span>
                    No integrations configured.{" "}
                    <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
                      Add secrets in Settings
                    </Link>{" "}
                    to activate the live pipeline.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Requires Action */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Requires Action</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/drafts">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 bg-muted/50 animate-pulse rounded-md" />
                  ))}
                </div>
              ) : isDemo ? (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <FlaskConical className="mx-auto h-7 w-7 opacity-20" />
                  <p>No real pending drafts.</p>
                  <p className="text-xs">
                    Use{" "}
                    <Link href="/test-flow" className="text-primary underline-offset-2 hover:underline">
                      Test Flow
                    </Link>{" "}
                    to simulate the pipeline, or connect integrations to start receiving real replies.
                  </p>
                </div>
              ) : pendingDrafts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="mx-auto h-7 w-7 mb-2 opacity-20" />
                  <p>No pending drafts to review.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendingDrafts?.slice(0, 5).map((draft) => (
                    <div
                      key={draft.id}
                      className="flex items-center justify-between p-3 border border-border rounded-md bg-card hover:bg-accent/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {draft.prospectName}{" "}
                          <span className="text-muted-foreground font-normal">
                            ({draft.prospectCompany})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">
                          {draft.replyText}
                        </div>
                      </div>
                      <Button size="sm" asChild className="shrink-0 ml-3">
                        <Link href={`/drafts/${draft.id}`}>Review</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Recent Activity */}
        <div>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
                {isDemo && !activityLoading && (activity?.length ?? 0) > 0 && (
                  <Badge className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 text-[10px] font-mono shrink-0">
                    DEMO
                  </Badge>
                )}
                {!isDemo && !activityLoading && (activity?.length ?? 0) > 0 && (
                  <Badge className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 text-[10px] font-mono shrink-0">
                    LIVE
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-muted/50 animate-pulse rounded-md" />
                  ))}
                </div>
              ) : isDemo && (activity?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <Activity className="mx-auto h-7 w-7 opacity-20" />
                  <p>No real activity yet.</p>
                  <p className="text-xs leading-relaxed">
                    Run a{" "}
                    <Link href="/test-flow" className="text-primary underline-offset-2 hover:underline">
                      Test Flow
                    </Link>{" "}
                    or connect integrations to start seeing events here.
                  </p>
                </div>
              ) : !isDemo && (activity?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <Activity className="mx-auto h-7 w-7 opacity-20" />
                  <p>No activity yet.</p>
                  <p className="text-xs">Events will appear once the pipeline starts processing replies.</p>
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-border -mx-6 px-0">
                  {isDemo && (
                    <div className="px-6 pb-3 pt-0">
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono uppercase tracking-wider">
                        Demo data — not real pipeline events
                      </p>
                    </div>
                  )}
                  {activity?.map((item) => (
                    <div key={item.id} className="flex gap-3 text-sm px-6 py-2.5">
                      <div className="mt-2 shrink-0">
                        <div className={`w-1.5 h-1.5 rounded-full ${isDemo ? "bg-amber-400/60" : "bg-primary/60"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-foreground leading-snug text-xs">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {item.clientName && ` · ${item.clientName}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick actions footer */}
      {isDemo && !intLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <QuickActionCard
            href="/test-flow"
            icon={FlaskConical}
            title="Run Test Flow"
            description="Simulate the full pipeline end-to-end"
          />
          <QuickActionCard
            href="/settings"
            icon={Settings}
            title="Configure Integrations"
            description="Add Slack, Lemlist, and Claude secrets"
          />
          <QuickActionCard
            href="/onboarding"
            icon={Users}
            title="Client Onboarding"
            description="Set up your first client account"
          />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  loading,
  alert,
  isDemo,
  emptyLabel,
}: {
  title: string;
  value?: number;
  icon: React.ElementType;
  loading: boolean;
  alert?: boolean;
  isDemo: boolean;
  emptyLabel: string;
}) {
  const isEmpty = value === 0 || value === undefined;

  return (
    <Card className={alert ? "border-amber-300 dark:border-amber-900/60" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${
            alert ? "text-amber-500" : "text-muted-foreground/60"
          }`}
        />
      </CardHeader>
      <CardContent className="pt-1 pb-4 px-4">
        {loading ? (
          <div className="h-7 w-12 bg-muted animate-pulse rounded" />
        ) : (
          <div className="space-y-0.5">
            <div
              className={`text-2xl font-bold tabular-nums ${
                alert ? "text-amber-600 dark:text-amber-500" : ""
              } ${isEmpty && !isDemo ? "text-muted-foreground/50" : ""}`}
            >
              {value ?? 0}
            </div>
            {isEmpty && isDemo && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono uppercase tracking-wider">
                {emptyLabel}
              </p>
            )}
            {isEmpty && !isDemo && (
              <p className="text-[10px] text-muted-foreground font-mono">{emptyLabel}</p>
            )}
            {!isEmpty && isDemo && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-mono uppercase tracking-wider">
                Demo data
              </p>
            )}
            {!isEmpty && !isDemo && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono uppercase tracking-wider">
                Real data
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkflowStep({
  name,
  icon: Icon,
  connected,
  loading,
  description,
}: {
  name: string;
  icon: React.ElementType;
  connected?: boolean;
  loading: boolean;
  description: string;
}) {
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center gap-1 px-2 py-2">
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-md transition-colors">
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold border ${
          connected
            ? "bg-primary/10 text-primary border-primary/30 dark:bg-primary/20"
            : "bg-muted/40 text-muted-foreground border-border"
        }`}
      >
        <Icon className="h-3 w-3" />
        {name}
      </div>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{description}</p>
      <span
        className={`text-[9px] font-mono font-semibold uppercase tracking-wider ${
          connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
        }`}
      >
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

function ChainArrow() {
  return (
    <div className="flex items-center justify-center text-muted-foreground/30 px-0.5 shrink-0 self-start mt-4 sm:self-center sm:mt-0">
      <ArrowRight className="h-3.5 w-3.5 hidden sm:block" />
      <div className="w-px h-3 bg-border block sm:hidden mx-auto" />
    </div>
  );
}

function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <div className="rounded-md border border-border bg-card hover:bg-accent/30 transition-colors p-4 flex items-start gap-3 cursor-pointer h-full">
        <div className="w-7 h-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </Link>
  );
}
