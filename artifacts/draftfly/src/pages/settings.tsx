import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure global application preferences and view integration status.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>API Version</Label>
                <Input value="v0.2.0" disabled className="bg-muted font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Input value="Beta" disabled className="bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Operating Modes</CardTitle>
            <CardDescription>Default behavior for new clients.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-md">
              <Label>Default Client Mode</Label>
              <Select defaultValue="draft" disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (Manual Approval)</SelectItem>
                  <SelectItem value="auto">Auto (Direct Send)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Auto mode is currently disabled in beta. All replies require manual approval.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integrations Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            <div className="divide-y divide-border border-t">
              <IntegrationRow 
                name="Lemlist" 
                status="connected" 
                detail="Campaign webhooks active"
              />
              <IntegrationRow 
                name="Claude API" 
                status="connected" 
                detail="Anthropic model available"
              />
              <IntegrationRow 
                name="Slack" 
                status="connected" 
                detail="Bot token verified"
              />
              <IntegrationRow 
                name="LinkedIn" 
                status="unavailable" 
                detail="Not available"
              />
            </div>
            
            <div className="p-4 bg-muted/20 text-sm text-muted-foreground flex items-start gap-2 border-t">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>LinkedIn does not provide a direct API for message automation. DraftFly works with Lemlist campaigns only.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IntegrationRow({ name, status, detail }: { name: string, status: "connected" | "unavailable", detail: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-card" data-testid={`integration-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div>
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <div>
        {status === "connected" ? (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20 font-normal">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-muted-foreground hover:bg-muted font-normal">
            <XCircle className="h-3 w-3 mr-1" /> Unavailable
          </Badge>
        )}
      </div>
    </div>
  );
}
