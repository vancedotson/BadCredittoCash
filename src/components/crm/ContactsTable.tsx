"use client";

import { useState } from "react";
import Link from "next/link";
import type { Contact } from "@/lib/store";
import { contactsToCsv } from "@/lib/csv";
import { StageBadge, SegmentBadge } from "./ui";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function download(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ContactsTable({ rows }: { rows: Contact[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const some = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exportSelected() {
    const chosen = rows.filter((r) => selected.has(r.id));
    if (chosen.length) download(contactsToCsv(chosen), "vance-contacts-selected.csv");
  }

  return (
    <div className="space-y-3">
      {/* Selection action bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-mist bg-sky px-4 py-2.5 text-sm">
          <span className="font-medium text-trust">{selected.size} selected</span>
          <button
            type="button"
            onClick={exportSelected}
            className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep"
          >
            Export selected CSV
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-slate hover:text-heading">
            Clear
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-mist bg-card">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-mist bg-cloud text-xs uppercase tracking-wide text-slate">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer accent-trust"
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Segment</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 text-right font-medium">Watch</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate">
                  No contacts match these filters.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <tr key={c.id} className={`transition-colors ${checked ? "bg-sky/50" : "hover:bg-cloud"}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(c.id)}
                        className="h-4 w-4 cursor-pointer accent-trust"
                        aria-label={`Select ${c.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/crm/contacts/${c.id}`} className="text-heading hover:text-trust hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate">{c.email}</td>
                    <td className="px-4 py-3"><StageBadge stage={c.stage} /></td>
                    <td className="px-4 py-3"><SegmentBadge segment={c.segment} /></td>
                    <td className="px-4 py-3 capitalize text-slate">{c.utm?.utm_source ?? c.source ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate">{c.watchPct ? `${c.watchPct}%` : "—"}</td>
                    <td className="px-4 py-3 text-slate">{fmtDate(c.lastActivityAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
