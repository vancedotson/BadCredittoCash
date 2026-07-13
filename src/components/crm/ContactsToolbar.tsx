"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { STAGES_IN_ORDER, STAGE_LABELS } from "@/lib/stages";
import { SEGMENTS_IN_ORDER, SEGMENT_LABELS } from "@/lib/segments";

const inputClass =
  "rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none transition-colors placeholder:text-slate/60 focus:border-trust";

export function ContactsToolbar() {
  const router = useRouter();
  const sp = useSearchParams();

  function push(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page"); // reset paging on any filter change
    router.push(`/crm/contacts?${params.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        push({ q: String(f.get("q") ?? "") });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        name="q"
        defaultValue={sp.get("q") ?? ""}
        placeholder="Search name or email…"
        className={`${inputClass} min-w-[200px] flex-1`}
        aria-label="Search contacts"
      />
      <select value={sp.get("stage") ?? ""} onChange={(e) => push({ stage: e.target.value })} className={inputClass} aria-label="Filter by stage">
        <option value="">All stages</option>
        {STAGES_IN_ORDER.map((s) => (
          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
        ))}
      </select>
      <select value={sp.get("segment") ?? ""} onChange={(e) => push({ segment: e.target.value })} className={inputClass} aria-label="Filter by segment">
        <option value="">All segments</option>
        {SEGMENTS_IN_ORDER.map((s) => (
          <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>
        ))}
      </select>
      <select value={sp.get("sort") ?? "recent"} onChange={(e) => push({ sort: e.target.value })} className={inputClass} aria-label="Sort">
        <option value="recent">Recent activity</option>
        <option value="created">Newest</option>
        <option value="name">Name</option>
      </select>
    </form>
  );
}
