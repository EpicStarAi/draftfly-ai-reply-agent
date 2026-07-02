import { useGetDraft, useApplyDraftAction, getGetDraftQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, Send, User, Building, Mail } from "lucide-react";
import { DraftStatusBadge } from "@/components/status-badges";

export default function DraftDetail() {
  const { id } = useParams();
  const draftId = parseInt(id || "0", 10);
  
  const { data: draft, isLoading } = useGetDraft(draftId, { query: { enabled: !!draftId, queryKey: getGetDraftQueryKey(draftId) } });
  const applyAction = useApplyDraftAction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editText, setEditText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (draft && !isEditing) {
      setEditText(draft.editedReplyText || draft.replyText);
    }
  }, [draft, isEditing]);

  const handleAction = (action: "send" | "edit" | "discard") => {
    const payload: any = { action };
    if (action === "edit") {
      payload.editedText = editText;
    }
    
    applyAction.mutate({ id: draftId, data: payload }, {
      onSuccess: (updated) => {
        queryClient.setQueryData(getGetDraftQueryKey(draftId), updated);
        setIsEditing(false);
        toast({ title: `Draft ${action === 'edit' ? 'edited' : action + 't'}` });
      },
      onError: () => {
        toast({ title: "Failed to apply action", variant: "destructive" });
      }
    });
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading draft...</div>;
  if (!draft) return <div className="p-8 text-center text-muted-foreground">Draft not found.</div>;

  const isPending = draft.status === "pending";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drafts"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Review Reply</h1>
              <DraftStatusBadge status={draft.status as any} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">Generated {new Date(draft.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Prospect Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><User className="h-4 w-4" /></div>
                <div>
                  <div className="font-medium">{draft.prospectName}</div>
                  <div className="text-muted-foreground text-xs">Name</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Building className="h-4 w-4" /></div>
                <div>
                  <div className="font-medium">{draft.prospectCompany || "Unknown"}</div>
                  <div className="text-muted-foreground text-xs">Company</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Mail className="h-4 w-4" /></div>
                <div>
                  <div className="font-medium">{draft.prospectEmail}</div>
                  <div className="text-muted-foreground text-xs">Email</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 bg-muted/20 border-b">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Conversation Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-sm whitespace-pre-wrap p-4 bg-muted/30 border rounded-md font-serif italic text-muted-foreground">
                {draft.conversationSnippet || "No conversation history available."}
              </div>
            </CardContent>
          </Card>

          <Card className={isPending ? "border-primary/50 shadow-md" : ""}>
            <CardHeader className="pb-3 bg-muted/20 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Generated Reply</CardTitle>
              {isPending && !isEditing && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>Edit Text</Button>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {isEditing ? (
                <Textarea 
                  className="min-h-[200px] text-base leading-relaxed" 
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  autoFocus
                />
              ) : (
                <div className="text-base whitespace-pre-wrap leading-relaxed">
                  {draft.editedReplyText || draft.replyText}
                </div>
              )}
            </CardContent>
            
            {isPending && (
              <CardFooter className="border-t bg-muted/10 pt-4 flex justify-between gap-3">
                {isEditing ? (
                  <>
                    <Button variant="ghost" onClick={() => { setIsEditing(false); setEditText(draft.editedReplyText || draft.replyText); }}>Cancel</Button>
                    <Button onClick={() => handleAction("edit")} disabled={applyAction.isPending}><Check className="h-4 w-4 mr-2" /> Save & Mark Edited</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => handleAction("discard")} disabled={applyAction.isPending}>
                      <X className="h-4 w-4 mr-2" /> Discard
                    </Button>
                    <Button className="flex-1" onClick={() => handleAction("send")} disabled={applyAction.isPending}>
                      <Send className="h-4 w-4 mr-2" /> Approve & Send
                    </Button>
                  </>
                )}
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
