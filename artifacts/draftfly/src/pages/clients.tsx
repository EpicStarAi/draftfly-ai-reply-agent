import { useListClients, useCreateClient, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Users, Plus, TriangleAlert } from "lucide-react";
import { ClientModeBadge } from "@/components/status-badges";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SLACK_CHANNEL_ID_RE = /^[CG][A-Z0-9]{9,}$/;

function isPlaceholderChannel(channel: string | null | undefined): boolean {
  if (!channel) return true;
  return !SLACK_CHANNEL_ID_RE.test(channel);
}

export default function ClientsPage() {
  const { data: clients, isLoading } = useListClients();
  const createClient = useCreateClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    slackChannel: "",
    mode: "draft" as "draft" | "auto"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createClient.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        setOpen(false);
        setFormData({ name: "", company: "", slackChannel: "", mode: "draft" });
        toast({ title: "Client created" });
      },
      onError: (err) => {
        toast({ title: "Error creating client", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage client accounts and their operating modes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slackChannel">Slack Channel</Label>
                <Input id="slackChannel" required placeholder="#client-name" value={formData.slackChannel} onChange={e => setFormData({ ...formData, slackChannel: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mode">Mode</Label>
                <Select value={formData.mode} onValueChange={(val: "draft" | "auto") => setFormData({ ...formData, mode: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (Manual Approval)</SelectItem>
                    <SelectItem value="auto">Auto (Direct Send)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createClient.isPending}>
                {createClient.isPending ? "Creating..." : "Create Client"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)
        ) : clients?.map(client => (
          <Card key={client.id} className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg font-semibold">
                  <Link href={`/clients/${client.id}`} className="hover:underline">{client.name}</Link>
                </CardTitle>
                <ClientModeBadge mode={client.mode} />
              </div>
              <div className="text-sm text-muted-foreground">{client.company || "No company"}</div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm mt-4">
                <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="truncate">{client.slackChannel || "No channel"}</span>
                  {isPlaceholderChannel(client.slackChannel) && (
                    <span
                      title="Placeholder Slack channel — update before going live"
                      className="inline-flex items-center gap-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-300 dark:border-amber-700"
                    >
                      <TriangleAlert className="h-2.5 w-2.5" />
                      Placeholder
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0 ml-2">
                  <Link href={`/clients/${client.id}`}>Manage</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
