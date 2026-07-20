import { useState, useEffect, useCallback, useRef } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
    Telegram?: {
      WebApp: {
        ready(): void;
        expand(): void;
        colorScheme: "light" | "dark";
        themeParams: Record<string, string>;
        initDataUnsafe: { user?: { first_name?: string } };
        HapticFeedback: {
          impactOccurred(style: "light" | "medium" | "heavy"): void;
          notificationOccurred(type: "error" | "success" | "warning"): void;
        };
      };
    };
  }
}

const BASE = "";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

type DraftStatus = "pending" | "sent" | "edited" | "discarded" | "send_failed";

interface Draft {
  id: number;
  clientId: number;
  campaignId: number;
  prospectEmail: string;
  prospectName: string;
  prospectCompany?: string | null;
  prospectRole?: string | null;
  conversationSnippet?: string | null;
  replyText: string;
  editedReplyText?: string | null;
  status: DraftStatus;
  actionedAt?: string | null;
  createdAt: string;
}

interface DashboardStats {
  totalClients: number;
  activeCampaigns: number;
  pendingDrafts: number;
  totalSent: number;
  sentToday: number;
  successRate: number;
}

type Tab = "pending" | "history";

function StatsBar({ stats }: { stats: DashboardStats }) {
  return (
    <div className="stats-bar">
      <div className="stat-item">
        <span className="stat-value pending">{stats.pendingDrafts}</span>
        <span className="stat-label">Pending</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value">{stats.sentToday ?? 0}</span>
        <span className="stat-label">Sent today</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value">{stats.totalSent}</span>
        <span className="stat-label">Total sent</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value accent">{stats.successRate}%</span>
        <span className="stat-label">Success rate</span>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  onAction,
}: {
  draft: Draft;
  onAction: (id: number, action: string, editedText?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(draft.replyText);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const rec = new SR();
    rec.lang = "ru-RU";
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) setEditText((prev) => prev + (prev.endsWith(" ") ? "" : " ") + transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isListening]);

  const initials = draft.prospectName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="draft-card">
      <div className="draft-header" onClick={() => !editing && setExpanded((e) => !e)}>
        <div className="prospect-avatar">{initials}</div>
        <div className="prospect-info">
          <div className="prospect-name">{draft.prospectName}</div>
          <div className="prospect-meta">
            {draft.prospectCompany && <span>{draft.prospectCompany}</span>}
            {draft.prospectRole && <span className="role"> · {draft.prospectRole}</span>}
          </div>
        </div>
        <div className="expand-icon">{expanded ? "▲" : "▼"}</div>
      </div>

      {!expanded && (
        <div className="reply-preview">
          {draft.replyText.slice(0, 120)}
          {draft.replyText.length > 120 ? "…" : ""}
        </div>
      )}

      {expanded && (
        <div className="reply-full">
          {draft.conversationSnippet && (
            <div className="snippet">
              <div className="snippet-label">THEIR MESSAGE</div>
              <div className="snippet-text">{draft.conversationSnippet}</div>
            </div>
          )}
          <div className="reply-label">AI DRAFT</div>
          {editing ? (
            <div className="edit-wrapper">
              <textarea
                className="reply-edit"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={8}
              />
              <button
                className={`mic-btn${isListening ? " mic-btn--active" : ""}`}
                onClick={toggleVoice}
                title={isListening ? "Stop recording" : "Dictate edit"}
                type="button"
              >
                {isListening ? "⏹" : "🎙"}
              </button>
              {isListening && <div className="mic-hint">Listening… tap ⏹ to stop</div>}
            </div>
          ) : (
            <div className="reply-text">{draft.replyText}</div>
          )}
        </div>
      )}

      <div className="draft-actions">
        {editing ? (
          <>
            <button
              className="btn btn-send"
              onClick={() => {
                onAction(draft.id, "edit", editText);
                setEditing(false);
              }}
            >
              Send edited
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-send" onClick={() => onAction(draft.id, "send")}>
              Send
            </button>
            <button
              className="btn btn-edit"
              onClick={() => {
                setExpanded(true);
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button className="btn btn-discard" onClick={() => onAction(draft.id, "discard")}>
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryCard({ draft }: { draft: Draft }) {
  const statusColor: Record<DraftStatus, string> = {
    sent: "#22c55e",
    edited: "#6366f1",
    discarded: "#ef4444",
    pending: "#f59e0b",
    send_failed: "#ef4444",
  };

  return (
    <div className="draft-card history">
      <div className="draft-header">
        <div className="prospect-avatar" style={{ opacity: 0.6 }}>
          {draft.prospectName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className="prospect-info">
          <div className="prospect-name">{draft.prospectName}</div>
          <div className="prospect-meta">
            {draft.prospectCompany && <span>{draft.prospectCompany}</span>}
          </div>
        </div>
        <span
          className="status-badge"
          style={{ color: statusColor[draft.status] ?? "#888" }}
        >
          {draft.status}
        </span>
      </div>
      <div className="reply-preview" style={{ opacity: 0.65 }}>
        {(draft.editedReplyText ?? draft.replyText).slice(0, 100)}…
      </div>
    </div>
  );
}

function AppInner() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("pending");

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["stats"],
    queryFn: () => apiFetch<DashboardStats>("/dashboard/stats"),
    refetchInterval: 15_000,
  });

  const { data: pending = [], isLoading: loadingPending } = useQuery<Draft[]>({
    queryKey: ["drafts", "pending"],
    queryFn: () => apiFetch<Draft[]>("/drafts/pending"),
    refetchInterval: 15_000,
    enabled: tab === "pending",
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<Draft[]>({
    queryKey: ["drafts", "history"],
    queryFn: () => apiFetch<Draft[]>("/drafts?status=sent"),
    enabled: tab === "history",
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      editedText,
    }: {
      id: number;
      action: string;
      editedText?: string;
    }) =>
      apiFetch<Draft>(`/drafts/${id}/action`, {
        method: "PATCH",
        body: JSON.stringify({ action, editedReplyText: editedText }),
      }),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ["drafts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      window.Telegram?.WebApp.HapticFeedback.notificationOccurred("success");
      toast({
        title: action === "send" ? "Reply sent" : action === "edit" ? "Edited & sent" : "Discarded",
        duration: 2000,
      });
    },
    onError: () => {
      window.Telegram?.WebApp.HapticFeedback.notificationOccurred("error");
      toast({ title: "Action failed", variant: "destructive", duration: 3000 });
    },
  });

  const handleAction = useCallback(
    (id: number, action: string, editedText?: string) => {
      actionMutation.mutate({ id, action, editedText });
    },
    [actionMutation],
  );

  const userName = window.Telegram?.WebApp.initDataUnsafe?.user?.first_name;

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <img src="/logo.png" alt="DraftFly" className="logo-img" />
        </div>
        {userName && <span className="user-name">Hi, {userName}</span>}
      </header>

      {stats && <StatsBar stats={stats} />}

      <div className="tab-bar">
        <button
          className={`tab ${tab === "pending" ? "active" : ""}`}
          onClick={() => setTab("pending")}
        >
          Pending
          {(stats?.pendingDrafts ?? 0) > 0 && (
            <span className="tab-badge">{stats!.pendingDrafts}</span>
          )}
        </button>
        <button
          className={`tab ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          Sent history
        </button>
      </div>

      <div className="draft-list">
        {tab === "pending" && (
          <>
            {loadingPending && <div className="loading">Loading drafts…</div>}
            {!loadingPending && pending.length === 0 && (
              <div className="empty">
                <div className="empty-icon">✓</div>
                <div className="empty-title">All clear</div>
                <div className="empty-sub">No pending drafts right now</div>
              </div>
            )}
            {pending.map((d) => (
              <DraftCard key={d.id} draft={d} onAction={handleAction} />
            ))}
          </>
        )}

        {tab === "history" && (
          <>
            {loadingHistory && <div className="loading">Loading history…</div>}
            {!loadingHistory && history.length === 0 && (
              <div className="empty">
                <div className="empty-sub">No sent replies yet</div>
              </div>
            )}
            {history.map((d) => (
              <HistoryCard key={d.id} draft={d} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    window.Telegram?.WebApp.ready();
    window.Telegram?.WebApp.expand();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
      <Toaster />
    </QueryClientProvider>
  );
}
