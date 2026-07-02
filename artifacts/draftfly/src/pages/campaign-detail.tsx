import { useGetCampaign, useUpdateCampaign, useGetCampaignStats, getGetCampaignQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BarChart } from "lucide-react";

export default function CampaignDetail() {
  const { id } = useParams();
  const campaignId = parseInt(id || "0", 10);
  
  const { data: campaign, isLoading } = useGetCampaign(campaignId, { query: { enabled: !!campaignId, queryKey: getGetCampaignQueryKey(campaignId) } });
  const { data: stats } = useGetCampaignStats(campaignId, { query: { enabled: !!campaignId } });
  const updateCampaign = useUpdateCampaign();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    lemlistCampaignId: "",
    persona: "",
    systemPrompt: ""
  });

  useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        lemlistCampaignId: campaign.lemlistCampaignId,
        persona: campaign.persona,
        systemPrompt: campaign.systemPrompt || ""
      });
    }
  }, [campaign]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCampaign.mutate({ id: campaignId, data: formData }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetCampaignQueryKey(campaignId), updated);
        toast({ title: "Campaign updated" });
      },
      onError: () => {
        toast({ title: "Failed to update campaign", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading campaign...</div>;
  if (!campaign) return <div className="p-8 text-center text-muted-foreground">Campaign not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Lemlist ID: <span className="font-mono">{campaign.lemlistCampaignId}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lemlistCampaignId">Lemlist ID</Label>
                    <Input id="lemlistCampaignId" required value={formData.lemlistCampaignId} onChange={e => setFormData({ ...formData, lemlistCampaignId: e.target.value })} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="persona">Persona</Label>
                  <Input id="persona" required value={formData.persona} onChange={e => setFormData({ ...formData, persona: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">Custom System Prompt</Label>
                  <Textarea 
                    id="systemPrompt" 
                    className="min-h-[150px] font-mono text-xs" 
                    placeholder="Override default instructions for Claude..."
                    value={formData.systemPrompt} 
                    onChange={e => setFormData({ ...formData, systemPrompt: e.target.value })} 
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={updateCampaign.isPending}>
                    {updateCampaign.isPending ? "Saving..." : "Save Config"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart className="h-4 w-4" /> Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-muted-foreground">Total Replies</span>
                    <span className="font-semibold">{stats.totalReplies}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-semibold text-yellow-600 dark:text-yellow-500">{stats.pending}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-muted-foreground">Auto/Sent</span>
                    <span className="font-semibold text-green-600 dark:text-green-500">{stats.sent}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b">
                    <span className="text-muted-foreground">Edited</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-500">{stats.edited}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Discarded</span>
                    <span className="font-semibold text-red-600 dark:text-red-500">{stats.discarded}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading stats...</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
