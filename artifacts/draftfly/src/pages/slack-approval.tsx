import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, MessageSquare } from "lucide-react";

export default function SlackApproval() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-title">Slack Approval Flow</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clients interact only through Slack. They never see this dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">How it Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">1</div>
                <div>
                  <div className="font-medium">Draft Generated</div>
                  <div className="text-sm text-muted-foreground mt-1">Lemlist detects a reply, n8n orchestrates, Claude generates a draft, and DraftFly posts it to the client's Slack channel.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">2</div>
                <div>
                  <div className="font-medium">Client Reviews in Slack</div>
                  <div className="text-sm text-muted-foreground mt-1">The client reads the prospect's message and the AI's suggested reply.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">3</div>
                <div>
                  <div className="font-medium">Action Taken</div>
                  <div className="text-sm text-muted-foreground mt-1">The client clicks Send, Edit Reply, or Discard directly within Slack.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold mt-0.5 shrink-0">4</div>
                <div>
                  <div className="font-medium">Reply Sent</div>
                  <div className="text-sm text-muted-foreground mt-1">DraftFly pushes the approved or edited reply back to Lemlist to be sent.</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Client View Mockup</h3>
          
          <div className="bg-[#1A1D21] border border-[#272A2E] rounded-md p-4 shadow-xl text-[15px] leading-relaxed">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded bg-primary flex items-center justify-center shrink-0">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-[#D1D2D3]">DraftFly App</span>
                  <span className="bg-[#2C3136] text-[#D1D2D3] text-[10px] px-1 rounded uppercase font-bold tracking-wider relative top-[-1px]">App</span>
                  <span className="text-xs text-[#ABABAD]">11:42 AM</span>
                </div>
                
                <div className="mt-1 space-y-3">
                  <div className="text-[#D1D2D3]">
                    <span className="font-bold">New Reply from John Smith (Acme Corp)</span>
                  </div>
                  
                  <div className="border-l-4 border-[#35373B] pl-3 py-1">
                    <div className="text-[#ABABAD] text-sm italic mb-1">"Hey, sounds interesting. Can you send me some more details on your pricing?"</div>
                  </div>
                  
                  <div className="bg-[#222529] border border-[#35373B] rounded p-3 text-[#D1D2D3]">
                    <div className="text-xs font-bold uppercase text-[#ABABAD] mb-2">Draft Reply:</div>
                    <p>Hi John,</p>
                    <p className="mt-2">Thanks for getting back to me! I'd be happy to share our pricing details.</p>
                    <p className="mt-2">Our plans typically start at $500/mo, but it depends heavily on your specific volume. Do you have 10 minutes next Tuesday to discuss what tier makes sense for Acme Corp?</p>
                    <p className="mt-2">Best,<br/>Sarah</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-3 pt-2">
                    <Button variant="default" size="sm" className="bg-[#007A5A] hover:bg-[#148567] text-white border-none h-8 font-bold" data-testid="mock-button-send">
                      <Check className="h-4 w-4 mr-1.5" /> Send Reply
                    </Button>
                    <Button variant="outline" size="sm" className="bg-[#222529] border-[#35373B] text-[#D1D2D3] hover:bg-[#2C3136] h-8 font-bold" data-testid="mock-button-edit">
                      <Pencil className="h-4 w-4 mr-1.5" /> Edit Reply
                    </Button>
                    <Button variant="outline" size="sm" className="bg-[#222529] border-[#35373B] text-[#E01E5A] hover:bg-[#2C3136] h-8 font-bold" data-testid="mock-button-discard">
                      <X className="h-4 w-4 mr-1.5" /> Discard
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
