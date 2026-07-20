import { useGetClient, useUpdateClient, useListCampaigns, getGetClientQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Megaphone, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { ClientModeBadge } from "@/components/status-badges";

function isRealSlackChannelId(value: string | null | undefined): boolean {
  return !!value && /^[CG][A-Z0-9]{9,}/.test(value);
}

function isRealSlackToken(value: string | null | undefined): boolean {
  return !!value && value.startsWith("xoxb-") && !value.includes("placeholder");
}

function SlackChannelStatus({ value }: { value: string }) {
  if (!value) {
    return (
      <p className="text-[11px] text-muted-foreground mt-1">
        Enter a real Slack Channel ID (e.g. <span className="font-mono">C0BK6NPBHKJ</span>) — found in Slack under channel details. Will fall back to the global <span className="font-mono">SLACK_CHANNEL_ID</span> env var if left as a placeholder.
      </p>
    );
  }
  if (isRealSlackChannelId(value)) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
          Valid Slack Channel ID — replies will post to this channel.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
      <p className="text-[11px] text-amber-600 dark:text-amber-400">
        Looks like a name, not a Slack Channel ID. Will fall back to the global <span className="font-mono">SLACK_CHANNEL_ID</span>. Copy the ID from Slack (starts with C or G).
      </p>
    </div>
  );
}

function SlackTokenStatus({ value }: { value: string }) {
  if (!value) {
    return (
      <p className="text-[11px] text-muted-foreground mt-1">
        Optional. Leave blank to use the global <span className="font-mono">SLACK_BOT_TOKEN</span>. Set a per-client token if this client uses a separate Slack workspace.
      </p>
    );
  }
  if (isRealSlackToken(value)) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
          Per-client bot token set — this token will be used for this client's Slack messages.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
      <p className="text-[11px] text-amber-600 dark:text-amber-400">
        Token doesn't look like a valid <span className="font-mono">xoxb-</span> bot token. Will fall back to global <span className="font-mono">SLACK_BOT_TOKEN</span>.
      </p>
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const clientId = parseInt(id || "0", 10);
  
  const { data: client, isLoading } = useGetClient(clientId, { query: { enabled: !!clientId, queryKey: getGetClientQueryKey(clientId) } });
  const { data: campaigns } = useListCampaigns({ clientId });
  const updateClient = useUpdateClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    slackChannel: "",
    slackBotToken: "",
    mode: "draft" as "draft" | "auto",
    lemlistApiKey: "",
    n8nWebhookUrl: ""
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        company: client.company || "",
        slackChannel: client.slackChannel,
        slackBotToken: client.slackBotToken || "",
        mode: client.mode,
        lemlistApiKey: client.lemlistApiKey || "",
        n8nWebhookUrl: client.n8nWebhookUrl || ""
      });
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClient.mutate({ id: clientId, data: formData }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetClientQueryKey(clientId), updated);
        toast({ title: "Client updated successfully" });
      },
      onError: () => {
        toast({ title: "Failed to update client", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading client...</div>;
  if (!client) return <div className="p-8 text-center text-muted-foreground">Client not found.</div>;

  const effectiveChannelIsReal = isRealSlackChannelId(formData.slackChannel);
  const effectiveTokenIsReal = isRealSlackToken(formData.slackBotToken);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <ClientModeBadge mode={client.mode} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Client ID: {client.id} · Created {new Date(client.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="mode">Operating Mode</Label>
                  <Select value={formData.mode} onValueChange={(val: "draft" | "auto") => setFormData({ ...formData, mode: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft (Manual Approval)</SelectItem>
                      <SelectItem value="auto">Auto (Direct Send)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Slack Configuration */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">Slack Configuration</h3>
                    {effectiveChannelIsReal ? (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-normal text-[10px] gap-1 h-5">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Channel configured
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-normal text-[10px] gap-1 h-5">
                        <AlertTriangle className="h-2.5 w-2.5" /> Using global fallback
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-md bg-muted/30 border border-border px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    <p>
                      Per-client Slack settings let each client's campaign replies post to their own Slack channel. If not set (or left as a placeholder), the webhook falls back to the global <span className="font-mono">SLACK_CHANNEL_ID</span> and <span className="font-mono">SLACK_BOT_TOKEN</span> env vars.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="slackChannel">
                      Slack Channel ID
                      <span className="text-muted-foreground font-normal ml-1.5 text-[11px]">required for per-client routing</span>
                    </Label>
                    <Input
                      id="slackChannel"
                      required
                      placeholder="C0BK6NPBHKJ"
                      className="font-mono text-sm"
                      value={formData.slackChannel}
                      onChange={e => setFormData({ ...formData, slackChannel: e.target.value })}
                    />
                    <SlackChannelStatus value={formData.slackChannel} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="slackBotToken">
                      Slack Bot Token
                      <span className="text-muted-foreground font-normal ml-1.5 text-[11px]">optional — override per client</span>
                    </Label>
                    <Input
                      id="slackBotToken"
                      type="password"
                      placeholder="xoxb-••••••••••••••••"
                      value={formData.slackBotToken}
                      onChange={e => setFormData({ ...formData, slackBotToken: e.target.value })}
                    />
                    <SlackTokenStatus value={formData.slackBotToken} />
                  </div>
                </div>

                {/* Other integrations */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <h3 className="text-sm font-medium">Other Integrations</h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="lemlistApiKey">Lemlist API Key</Label>
                    <Input id="lemlistApiKey" type="password" placeholder="sk_..." value={formData.lemlistApiKey} onChange={e => setFormData({ ...formData, lemlistApiKey: e.target.value })} />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="n8nWebhookUrl">n8n Webhook URL</Label>
                    <Input id="n8nWebhookUrl" placeholder="https://..." value={formData.n8nWebhookUrl} onChange={e => setFormData({ ...formData, n8nWebhookUrl: e.target.value })} />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={updateClient.isPending}>
                    {updateClient.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Slack routing summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Slack Routing</CardTitle>
              <CardDescription className="text-xs">How this client's replies get posted</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Channel</p>
                {effectiveChannelIsReal ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 break-all">{formData.slackChannel}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-amber-600 dark:text-amber-400">Using global fallback</span>
                    </div>
                    <p className="text-muted-foreground pl-5">Set <span className="font-mono">SLACK_CHANNEL_ID</span> env var or enter a real Channel ID above.</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-medium">Bot Token</p>
                {effectiveTokenIsReal ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-emerald-600 dark:text-emerald-400">Per-client token active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Global <span className="font-mono">SLACK_BOT_TOKEN</span></span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Campaigns</CardTitle>
              <CardDescription>Linked outreach campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns?.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No campaigns found.</div>
              ) : (
                <div className="space-y-3">
                  {campaigns?.map(camp => (
                    <div key={camp.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                      <div>
                        <Link href={`/campaigns/${camp.id}`} className="font-medium hover:underline text-sm block">{camp.name}</Link>
                        <span className="text-xs text-muted-foreground">{camp.lemlistCampaignId}</span>
                      </div>
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/campaigns">Manage Campaigns</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
