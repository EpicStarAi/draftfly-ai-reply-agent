import { useGetDashboardStats, useListPendingDrafts, useListActivity } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Users,
  Activity,
  Inbox,
  CheckCircle2,
  Megaphone,
  ArrowRight,
  Zap,
  Bot,
  MessageSquare,
  Link2,
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

function useIntegrationStatus() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/integrations/status`)
      .then((r) => r.json() as Promise<IntegrationStatus>)
      .then((s) => { setStatus(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { status, loading };
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: pendingDrafts, isLoading: draftsLoading } = useListPendingDrafts();
  const { data: activity, isLoading: activityLoading } = useListActivity({ limit: 10 });
  const { status: integrations, loading: intLoading } = useIntegrationStatus();

  const loading = statsLoading || intLoading;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live overview of your automated reply operations.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Clients"
          value={stats?.totalClients}
          icon={Users}
          loading={loading}
        />
        <KpiCard
          title="Active Campaigns"
          value={stats?.activeCampaigns}
          icon={Megaphone}
          loading={loading}
        />
        <KpiCard
          title="Pending Drafts"
          value={stats?.pendingDrafts}
          icon={Inbox}
          loading={loading}
          alert={!!stats?.pendingDrafts && stats.pendingDrafts > 0}
        />
        <KpiCard
          title="Total Sent"
          value={stats?.totalDraftsSent}
          icon={CheckCircle2}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Workflow Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Workflow Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="grid grid-cols-3 gap-4 text-center text-sm pt-1">
                <div>
                  <div className="font-semibold text-xl tabular-nums">
                    {loading ? <span className="text-muted-foreground/40">—</span> : (stats?.webhooksToday ?? 0)}
                  </div>
                  <div className="text-muted-foreground text-xs">Webhooks Today</div>
                </div>
                <div>
                  <div className="font-semibold text-xl tabular-nums">
                    {loading ? <span className="text-muted-foreground/40">—</span> : `${Math.round((stats?.successRate ?? 0) * 100)}%`}
                  </div>
                  <div className="text-muted-foreground text-xs">Success Rate</div>
                </div>
                <div>
                  <div className="font-semibold text-xl tabular-nums">
                    {loading ? <span className="text-muted-foreground/40">—</span> : (stats?.totalDraftsDiscarded ?? 0)}
                  </div>
                  <div className="text-muted-foreground text-xs">Discarded</div>
                </div>
              </div>
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
              ) : (pendingDrafts?.length ?? 0) === 0 ? (
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
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-muted/50 animate-pulse rounded-md" />
                  ))}
                </div>
              ) : (activity?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm space-y-2">
                  <Activity className="mx-auto h-7 w-7 opacity-20" />
                  <p>No activity yet.</p>
                  <p className="text-xs">Events will appear once the pipeline starts processing replies.</p>
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-border -mx-6 px-0">
                  {activity?.map((item) => (
                    <div key={item.id} className="flex gap-3 text-sm px-6 py-2.5">
                      <div className="mt-2 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
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
}: {
  title: string;
  value?: number;
  icon: React.ElementType;
  loading: boolean;
  alert?: boolean;
}) {
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
          <div
            className={`text-2xl font-bold tabular-nums ${
              alert ? "text-amber-600 dark:text-amber-500" : ""
            }`}
          >
            {value ?? 0}
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
