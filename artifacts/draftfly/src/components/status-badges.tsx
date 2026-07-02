import { Badge } from "@/components/ui/badge";

export function DraftStatusBadge({ status }: { status: "pending" | "sent" | "edited" | "discarded" }) {
  switch (status) {
    case "pending":
      return <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-900/50">Pending</Badge>;
    case "sent":
      return <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50">Sent</Badge>;
    case "edited":
      return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50">Edited</Badge>;
    case "discarded":
      return <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50">Discarded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ClientModeBadge({ mode }: { mode: "draft" | "auto" }) {
  if (mode === "auto") {
    return <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-900/50">Auto</Badge>;
  }
  return <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Draft</Badge>;
}

export function LogLevelBadge({ level }: { level: "info" | "warning" | "error" }) {
  switch (level) {
    case "info":
      return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50/50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-transparent">Info</Badge>;
    case "warning":
      return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50/50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-transparent">Warn</Badge>;
    case "error":
      return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50/50 dark:text-red-400 dark:border-red-900/50 dark:bg-transparent">Error</Badge>;
    default:
      return <Badge variant="outline">{level}</Badge>;
  }
}
