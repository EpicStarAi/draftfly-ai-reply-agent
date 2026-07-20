import { useListDrafts, useListCampaigns, useListClients } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { DraftStatusBadge } from "@/components/status-badges";

export default function ReplyHistoryPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  const queryParams: Record<string, unknown> = {};
  if (statusFilter !== "all") queryParams.status = statusFilter;
  if (clientFilter !== "all") queryParams.clientId = parseInt(clientFilter, 10);
  if (campaignFilter !== "all") queryParams.campaignId = parseInt(campaignFilter, 10);

  const { data: drafts, isLoading } = useListDrafts(queryParams as any);
  const { data: campaigns } = useListCampaigns(clientFilter !== "all" ? { clientId: parseInt(clientFilter, 10) } : {});
  const { data: clients } = useListClients();

  const sortedDrafts = drafts ? [...drafts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function truncate(text: string, max = 120) {
    return text.length > max ? text.slice(0, max) + "…" : text;
  }

  const campaignMap = new Map(campaigns?.map((c) => [c.id, c.name]) ?? []);
  const clientMap = new Map(clients?.map((c) => [c.id, c.name]) ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reply History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every Lemlist reply that triggered a Slack draft, with its final outcome.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setCampaignFilter("all"); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns?.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="edited">Edited</SelectItem>
              <SelectItem value="discarded">Discarded</SelectItem>
              <SelectItem value="send_failed">Send Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-4 py-3 w-40">Received</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3 w-36">Campaign</th>
                <th className="px-4 py-3 w-28">Status</th>
                <th className="px-4 py-3">Draft (final)</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center animate-pulse text-muted-foreground">
                    Loading reply history…
                  </td>
                </tr>
              ) : sortedDrafts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No replies found matching the selected filters.
                  </td>
                </tr>
              ) : (
                sortedDrafts.map((draft) => {
                  const finalText = draft.editedReplyText ?? draft.replyText;
                  const campaignName = campaignMap.get(draft.campaignId) ?? `Campaign ${draft.campaignId}`;
                  const clientName = clientMap.get(draft.clientId);
                  return (
                    <tr key={draft.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono">
                        {formatTime(draft.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{draft.prospectName}</div>
                        <div className="text-muted-foreground">{draft.prospectEmail}</div>
                        {clientName && (
                          <div className="text-[10px] text-muted-foreground/70 mt-0.5">{clientName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{campaignName}</td>
                      <td className="px-4 py-3">
                        <DraftStatusBadge status={draft.status as any} />
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <div className="leading-relaxed">{truncate(finalText)}</div>
                        <Link
                          href={`/drafts/${draft.id}`}
                          className="mt-1 inline-block text-[10px] text-primary hover:underline"
                        >
                          View full draft →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {sortedDrafts.length > 0 && (
          <div className="px-4 py-2 border-t text-xs text-muted-foreground bg-muted/30">
            {sortedDrafts.length} {sortedDrafts.length === 1 ? "reply" : "replies"} found
          </div>
        )}
      </Card>
    </div>
  );
}
