import type { LiveWebinarMessage } from "@/lib/live-webinar-types";
import { formatLiveDate } from "@/lib/live-webinar-display";

export function LiveWebinarMessages({ messages, timezone }: { messages: LiveWebinarMessage[]; timezone: string }) {
  if (!messages.length) return <p className="text-xs text-slate">No emails queued.</p>;
  return <details className="text-xs text-slate">
    <summary className="cursor-pointer font-medium text-trust">{messages.length} email{messages.length === 1 ? "" : "s"} · {messages.filter((message) => message.status === "sent").length} sent</summary>
    <ul className="mt-2 space-y-2">
      {messages.map((message) => <li key={message.id} className="rounded-lg border border-mist bg-cloud p-2">
        <div className="font-medium text-body">{message.templateKey.replace(/^live_/, "").replace(/_/g, " ")} · {message.status.replace(/_/g, " ")}</div>
        <div>{message.sentAt ? "Sent" : "Scheduled"} {formatLiveDate(message.sentAt ?? message.scheduledFor, timezone)}</div>
        {message.lastError ? <p className="mt-1 break-words text-red">{message.lastError}</p> : null}
      </li>)}
    </ul>
  </details>;
}
