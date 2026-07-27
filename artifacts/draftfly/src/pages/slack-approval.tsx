import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListClients,
  useUpdateClient,
  useGetSlackWorkspace,
  useListSlackChannels,
  useVerifySlackBotAccess,
  useSendSlackTestCard,
  getListClientsQueryKey,
  getVerifySlackBotAccessQueryKey,
  type Client,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Hash,
  Lock,
  RefreshCw,
  Slack,
} from "lucide-react";

const SLACK_CHANNEL_ID_RE = /^[CG][A-Z0-9]{9,}$/;

function isConfiguredChannel(channel: string | null | undefined): boolean {
  return !!channel && SLACK_CHANNEL_ID_RE.test(channel);
}

export default function SlackApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clients, isLoading: clientsLoading } = useListClients();
  const {
    data: workspace,
    isLoading: workspaceLoading,
    refetch: refetchWorkspace,
    isFetching: workspaceFetching,
  } = useGetSlackWorkspace();
  const {
    data: channels,
    isLoading: channelsLoading,
    error: channelsError,
    refetch: refetchChannels,
  } = useListSlackChannels();

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  // Verify bot access to the chosen channel before we allow saving.
  const { data: accessCheck, isFetching: verifying } = useVerifySlackBotAccess(
    { channelId: selectedChannelId },
    {
      query: {
        enabled: !!selectedChannelId,
        queryKey: getVerifySlackBotAccessQueryKey({ channelId: selectedChannelId }),
      },
    },
  );

  const updateClient = useUpdateClient();
  const sendTestCard = useSendSlackTestCard();

  const selectedClient = (clients ?? []).find((c) => String(c.id) === selectedClientId);
  const selectedChannel = (channels ?? []).find((c) => c.id === selectedChannelId);

  const canSave =
    !!selectedClient &&
    !!selectedChannelId &&
    accessCheck?.ok === true &&
    !updateClient.isPending;

  function handleSaveBinding() {
    if (!selectedClient || !selectedChannelId) return;
    updateClient.mutate(
      { id: selectedClient.id, data: { slackChannel: selectedChannelId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          toast({
            title: "Channel binding saved",
            description: `${selectedClient.name} → #${selectedChannel?.name ?? selectedChannelId}`,
          });
        },
        onError: () => {
          toast({ title: "Failed to save binding", variant: "destructive" });
        },
      },
    );
  }

  function handleSendTestCard() {
    if (!selectedChannelId) return;
    sendTestCard.mutate(
      { data: { channelId: selectedChannelId } },
      {
        onSuccess: (res) => {
          if (res.ok) {
            toast({
              title: "Test card sent",
              description: `Check #${selectedChannel?.name ?? selectedChannelId} in Slack. Buttons are safe — no real email is sent.`,
            });
          } else {
            toast({ title: "Test card failed", description: res.error ?? undefined, variant: "destructive" });
          }
        },
        onError: () => {
          toast({ title: "Test card failed", variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-title">
          Slack Channel Binding
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect each client to the Slack channel where their approval cards are posted.
        </p>
      </div>

      {/* Connection status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Slack className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Slack Connection</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchWorkspace()}
            disabled={workspaceFetching}
            data-testid="button-refresh-workspace"
          >
            <RefreshCw className={`h-4 w-4 ${workspaceFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {workspaceLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
            </div>
          ) : workspace?.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-green-600 hover:bg-green-600 text-white gap-1" data-testid="badge-connected">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </Badge>
              {workspace.teamName && (
                <span className="text-sm">
                  Workspace: <span className="font-medium">{workspace.teamName}</span>
                </span>
              )}
              {workspace.url && (
                <span className="text-xs text-muted-foreground font-mono">{workspace.url}</span>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Not connected</div>
                <div className="text-muted-foreground">
                  {workspace?.error ??
                    "Add SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET to Replit Secrets, then refresh."}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Binding form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bind a client to a channel</CardTitle>
          <CardDescription>
            Pick a client and the Slack channel to post their approval cards to. We verify the bot can
            post there before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client picker */}
            <div className="space-y-1.5">
              <Label htmlFor="client-select">Client</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="client-select" data-testid="select-client">
                  <SelectValue placeholder={clientsLoading ? "Loading…" : "Select a client"} />
                </SelectTrigger>
                <SelectContent>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Current:{" "}
                  {isConfiguredChannel(selectedClient.slackChannel) ? (
                    <span className="font-mono">{selectedClient.slackChannel}</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Not configured</span>
                  )}
                </p>
              )}
            </div>

            {/* Channel picker */}
            <div className="space-y-1.5">
              <Label htmlFor="channel-select">Slack channel</Label>
              <Select
                value={selectedChannelId}
                onValueChange={setSelectedChannelId}
                disabled={!!channelsError || channelsLoading}
              >
                <SelectTrigger id="channel-select" data-testid="select-channel">
                  <SelectValue placeholder={channelsLoading ? "Loading channels…" : "Select a channel"} />
                </SelectTrigger>
                <SelectContent>
                  {(channels ?? [])
                    .filter((ch) => !ch.isArchived)
                    .map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        <span className="inline-flex items-center gap-1.5">
                          {ch.isPrivate ? <Lock className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                          {ch.name}
                          {!ch.isMember && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400">(bot not in)</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {channelsError ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Couldn't load channels — check the bot token and scopes (channels:read, groups:read).{" "}
                  <button className="underline" onClick={() => refetchChannels()}>
                    Retry
                  </button>
                </p>
              ) : (
                selectedChannelId && (
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono">{selectedChannelId}</p>
                )
              )}
            </div>
          </div>

          {/* Access verification */}
          {selectedChannelId && (
            <div className="text-sm">
              {verifying ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying bot access…
                </span>
              ) : accessCheck?.ok ? (
                <span className="flex items-center gap-2 text-green-700 dark:text-green-400" data-testid="text-access-ok">
                  <CheckCircle2 className="h-4 w-4" /> Bot can post to #{accessCheck.name ?? selectedChannel?.name}
                </span>
              ) : (
                <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400" data-testid="text-access-fail">
                  <AlertTriangle className="h-4 w-4" /> {accessCheck?.error ?? "Bot cannot post here"}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleSaveBinding} disabled={!canSave} data-testid="button-save-binding">
              {updateClient.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Save channel binding
            </Button>
            <Button
              variant="outline"
              onClick={handleSendTestCard}
              disabled={!selectedChannelId || accessCheck?.ok !== true || sendTestCard.isPending}
              data-testid="button-send-test"
            >
              {sendTestCard.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Send test approval card
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Per-client binding status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client bindings</CardTitle>
          <CardDescription>Clients without a valid Slack Channel ID are shown as “Not configured”.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {clientsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading clients…
            </div>
          ) : (clients ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            (clients ?? []).map((c: Client) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                data-testid={`row-client-${c.id}`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  {c.company && <div className="text-xs text-muted-foreground truncate">{c.company}</div>}
                </div>
                {isConfiguredChannel(c.slackChannel) ? (
                  <Badge variant="outline" className="gap-1 font-mono text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    {c.slackChannel}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> Not configured
                  </Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
