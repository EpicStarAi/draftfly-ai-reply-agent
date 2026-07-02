import { useListCampaigns, useCreateCampaign, useListClients, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Megaphone, Plus, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function CampaignsPage() {
  const { data: campaigns, isLoading } = useListCampaigns();
  const { data: clients } = useListClients();
  const createCampaign = useCreateCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [formData, setFormData] = useState({
    clientId: "",
    name: "",
    lemlistCampaignId: "",
    persona: "",
    systemPrompt: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCampaign.mutate({ 
      data: { 
        ...formData, 
        clientId: parseInt(formData.clientId, 10) 
      } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        setOpen(false);
        setFormData({ clientId: "", name: "", lemlistCampaignId: "", persona: "", systemPrompt: "" });
        toast({ title: "Campaign created" });
      },
      onError: () => {
        toast({ title: "Error creating campaign", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Map Lemlist campaigns to AI personas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Campaign Mapping</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <Select value={formData.clientId} onValueChange={(val) => setFormData({ ...formData, clientId: val })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lemlistCampaignId">Lemlist Campaign ID</Label>
                <Input id="lemlistCampaignId" required value={formData.lemlistCampaignId} onChange={e => setFormData({ ...formData, lemlistCampaignId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="persona">Persona</Label>
                <Input id="persona" placeholder="e.g. Friendly Founder" required value={formData.persona} onChange={e => setFormData({ ...formData, persona: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt (Optional)</Label>
                <Textarea id="systemPrompt" className="min-h-[100px]" value={formData.systemPrompt} onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={createCampaign.isPending || !formData.clientId}>
                {createCampaign.isPending ? "Creating..." : "Create Mapping"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center animate-pulse text-muted-foreground">Loading campaigns...</div>
        ) : campaigns?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No campaigns mapped yet.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Lemlist ID</th>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3 text-right">Replies</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t">
              {campaigns?.map(camp => {
                const client = clients?.find(c => c.id === camp.clientId);
                return (
                  <tr key={camp.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/campaigns/${camp.id}`} className="hover:underline flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-muted-foreground" />
                        {camp.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {client ? <Link href={`/clients/${client.id}`} className="hover:underline">{client.name}</Link> : "Unknown"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{camp.lemlistCampaignId}</td>
                    <td className="px-4 py-3">{camp.persona}</td>
                    <td className="px-4 py-3 text-right font-medium flex items-center justify-end gap-1">
                      {camp.replyCount || 0}
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
