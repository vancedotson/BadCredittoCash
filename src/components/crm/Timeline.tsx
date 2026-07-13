import type { BehaviourEvent, Note } from "@/lib/store";
import { displayEvent } from "@/lib/event-display";
import { EventGlyph, toneClass } from "./ui";
import { DocumentIcon } from "@/components/marketing-v2/Icons";

type Row =
  | { at: string; kind: "event"; event: BehaviourEvent }
  | { at: string; kind: "note"; note: Note };

function eventDetail(e: BehaviourEvent): string {
  const p = e.props ?? {};
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  if (e.event === "quiz_completed") return [s(p.concern), s(p.tried), s(p.urgency)].filter(Boolean).join(" · ");
  if (e.event === "goal_replied" && p.goal) return `"${s(p.goal)}"`;
  if (e.event === "call_booked" && p.preferredTime) return `Preferred: ${s(p.preferredTime)}`;
  if (e.event === "email_queued" && p.sequence) return `Sequence: ${s(p.sequence)}`;
  return "";
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function Timeline({ events, notes }: { events: BehaviourEvent[]; notes: Note[] }) {
  const rows: Row[] = [
    ...events.map((event) => ({ at: event.createdAt, kind: "event" as const, event })),
    ...notes.map((note) => ({ at: note.createdAt, kind: "note" as const, note })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (rows.length === 0) {
    return <p className="text-sm text-slate">No activity yet.</p>;
  }

  return (
    <ol className="mt-1">
      {rows.map((row, i) => {
        const last = i === rows.length - 1;
        const isNote = row.kind === "note";
        const d = isNote ? null : displayEvent(row.event.event);
        const detail = isNote ? "" : eventDetail(row.event);
        return (
          <li key={isNote ? row.note.id : row.event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isNote ? "bg-navy/8 text-navy" : toneClass(d!.tone)}`}>
                {isNote ? <DocumentIcon className="h-3.5 w-3.5" /> : <EventGlyph icon={d!.icon} className="h-3.5 w-3.5" />}
              </span>
              {!last ? <span className="my-1 w-px flex-1 bg-mist" /> : null}
            </div>
            <div className="min-w-0 flex-1 pb-5">
              {isNote ? (
                <>
                  <div className="rounded-lg border border-mist bg-cloud px-3 py-2 text-sm text-body">{row.note.body}</div>
                  <div className="mt-1 text-xs text-slate">
                    {row.note.author ?? "Note"} · {fmt(row.at)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-body">{d!.label}</div>
                  {detail ? <div className="text-xs text-slate">{detail}</div> : null}
                  <div className="text-xs text-slate/70">{fmt(row.at)}</div>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
