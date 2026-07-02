import { useGetClient, useUpdateClient, useListCampaigns, getGetClientQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Megaphone } from "lucide-react";
import { ClientModeBadge } from "@/components/status-badges";

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
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="slackChannel">Slack Channel</Label>
                    <Input id="slackChannel" required value={formData.slackChannel} onChange={e => setFormData({ ...formData, slackChannel: e.target.value })} />
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
                </div>

                <div className="space-y-2 pt-4 border-t border-border mt-4">
                  <Label htmlFor="lemlistApiKey">Lemlist API Key</Label>
                  <Input id="lemlistApiKey" type="password" placeholder="sk_..." value={formData.lemlistApiKey} onChange={e => setFormData({ ...formData, lemlistApiKey: e.target.value })} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="n8nWebhookUrl">n8n Webhook URL</Label>
                  <Input id="n8nWebhookUrl" placeholder="https://..." value={formData.n8nWebhookUrl} onChange={e => setFormData({ ...formData, n8nWebhookUrl: e.target.value })} />
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
