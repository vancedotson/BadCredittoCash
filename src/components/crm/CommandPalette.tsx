"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactOption } from "@/lib/store";

type Item = { id: string; label: string; sub?: string; run: () => void };

export function CommandPalette({ contacts, onClose, onNewContact, onNewTask }: { contacts: ContactOption[]; onClose: () => void; onNewContact: () => void; onNewTask: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const go = (href: string) => () => { router.push(href); onClose(); };

  const commands: Item[] = useMemo(() => [
    { id: "new-contact", label: "New contact", sub: "Create", run: () => { onClose(); onNewContact(); } },
    { id: "new-task", label: "New task", sub: "Create", run: () => { onClose(); onNewTask(); } },
    { id: "go-overview", label: "Overview", sub: "Go to", run: go("/crm") },
    { id: "go-contacts", label: "Contacts", sub: "Go to", run: go("/crm/contacts") },
    { id: "go-pipeline", label: "Pipeline", sub: "Go to", run: go("/crm/pipeline") },
    { id: "go-tasks", label: "Tasks", sub: "Go to", run: go("/crm/tasks") },
    { id: "go-calendar", label: "Calendar", sub: "Go to", run: go("/crm/calendar") },
    { id: "go-activity", label: "Activity", sub: "Go to", run: go("/crm/activity") },
    { id: "go-sequences", label: "Sequences", sub: "Go to", run: go("/crm/sequences") },
    { id: "go-settings", label: "Settings", sub: "Go to", run: go("/crm/settings") },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const results: Item[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    const cmd = s ? commands.filter((c) => c.label.toLowerCase().includes(s)) : commands;
    const people: Item[] = (s ? contacts.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s)) : contacts.slice(0, 0))
      .slice(0, 8)
      .map((c) => ({ id: c.id, label: c.name, sub: c.email, run: go(`/crm/contacts/${c.id}`) }));
    return [...people, ...cmd].slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, contacts, commands]);

  const clamped = Math.min(i, Math.max(0, results.length - 1));

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy/40 p-4 pt-[12vh]" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-mist bg-card shadow-card" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((n) => Math.min(results.length - 1, n + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); results[clamped]?.run(); }
            else if (e.key === "Escape") onClose();
          }}
          placeholder="Search contacts or jump to…"
          className="w-full border-b border-mist bg-card px-4 py-3.5 text-sm text-body outline-none placeholder:text-slate"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate">No matches.</li>
          ) : results.map((r, idx) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseEnter={() => setI(idx)}
                onClick={r.run}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm ${idx === clamped ? "bg-sky" : "hover:bg-cloud"}`}
              >
                <span className="min-w-0 flex-1 truncate text-body">{r.label}</span>
                <span className="shrink-0 text-xs text-slate">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-mist px-4 py-2 text-xs text-slate">↑↓ to move · ↵ to select · esc to close</div>
      </div>
    </div>
  );
}
