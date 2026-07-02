import { useGetDashboardStats, useListPendingDrafts, useListActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Inbox, CheckCircle2, Megaphone, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: pendingDrafts, isLoading: draftsLoading } = useListPendingDrafts();
  const { data: activity, isLoading: activityLoading } = useListActivity({ limit: 10 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your automated reply operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats?.totalClients} icon={Users} loading={statsLoading} />
        <StatCard title="Active Campaigns" value={stats?.activeCampaigns} icon={Megaphone} loading={statsLoading} />
        <StatCard title="Pending Drafts" value={stats?.pendingDrafts} icon={Inbox} loading={statsLoading} alert={stats?.pendingDrafts && stats.pendingDrafts > 0} />
        <StatCard title="Total Sent" value={stats?.totalDraftsSent} icon={CheckCircle2} loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Workflow Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                <WorkflowStep name="Lemlist" active />
                <WorkflowArrow />
                <WorkflowStep name="n8n" active />
                <WorkflowArrow />
                <WorkflowStep name="Claude" active />
                <WorkflowArrow />
                <WorkflowStep name="Slack" active />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <div className="font-semibold text-xl">{stats?.webhooksToday || 0}</div>
                  <div className="text-muted-foreground text-xs">Webhooks Today</div>
                </div>
                <div>
                  <div className="font-semibold text-xl">{stats?.successRate || 0}%</div>
                  <div className="text-muted-foreground text-xs">Success Rate</div>
                </div>
                <div>
                  <div className="font-semibold text-xl">{stats?.totalDraftsDiscarded || 0}</div>
                  <div className="text-muted-foreground text-xs">Discarded</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Requires Action</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/drafts">View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
                </div>
              ) : pendingDrafts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="mx-auto h-8 w-8 mb-2 opacity-20" />
                  No pending drafts to review.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDrafts?.slice(0, 5).map(draft => (
                    <div key={draft.id} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-accent/50 transition-colors">
                      <div>
                        <div className="font-medium text-sm">{draft.prospectName} <span className="text-muted-foreground font-normal">({draft.prospectCompany})</span></div>
                        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[300px]">{draft.replyText}</div>
                      </div>
                      <Button size="sm" asChild>
                        <Link href={`/drafts/${draft.id}`}>Review</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {activity?.map(item => (
                    <div key={item.id} className="flex gap-3 text-sm">
                      <div className="mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-primary/40 mt-1.5" />
                      </div>
                      <div>
                        <p className="text-foreground leading-tight">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

function StatCard({ title, value, icon: Icon, loading, alert }: any) {
  return (
    <Card className={alert ? "border-amber-200 bg-amber-50/10 dark:border-amber-900/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? "text-amber-500" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-7 w-16 bg-muted animate-pulse rounded" />
        ) : (
          <div className={`text-2xl font-bold ${alert ? "text-amber-600 dark:text-amber-500" : ""}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkflowStep({ name, active }: { name: string, active?: boolean }) {
  return (
    <div className={`flex items-center justify-center px-3 py-1.5 rounded text-xs font-mono font-medium ${active ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"}`}>
      {name}
    </div>
  );
}

function WorkflowArrow() {
  return <div className="text-muted-foreground/50 hidden md:block">→</div>;
}
