"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = ["7", "30", "90"];

export function OverviewControls({ owners, currentOwner }: { owners: string[]; currentOwner?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const range = sp.get("range") ?? "30";
  const owner = sp.get("owner") ?? currentOwner ?? "__all__";

  function set(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    router.push(`/crm?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-mist bg-card p-0.5 text-sm">
        {RANGES.map((r) => (
          <button key={r} type="button" onClick={() => set({ range: r })} className={`rounded-md px-2.5 py-1.5 ${range === r ? "bg-navy text-white" : "text-slate"}`}>
            {r}d
          </button>
        ))}
      </div>
      <select value={owner} onChange={(e) => set({ owner: e.target.value })} className="rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust" aria-label="Owner">
        {currentOwner ? <option value={currentOwner}>My work ({currentOwner})</option> : null}
        <option value="__all__">All owners</option>
        <option value="__none__">Unassigned</option>
        {owners.filter((candidate) => candidate !== currentOwner).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
