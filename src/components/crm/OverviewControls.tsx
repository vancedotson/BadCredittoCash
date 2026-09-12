"use client";

import { useId, useSyncExternalStore, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const RANGES = ["7", "30", "90"];
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function OverviewControls({ owners, currentOwner }: { owners: string[]; currentOwner?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const ownerId = useId();
  const [pending, startTransition] = useTransition();
  const interactive = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const requestedRange = sp.get("range") ?? "30";
  const range = RANGES.includes(requestedRange) ? requestedRange : "30";
  const owner = sp.get("owner") ?? currentOwner ?? "__all__";
  const disabled = pending || !interactive;

  function set(next: Record<string, string>) {
    if (disabled) return;
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    p.set("range", RANGES.includes(p.get("range") ?? "") ? p.get("range")! : "30");
    startTransition(() => router.push(`/crm?${p.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3" aria-busy={pending}>
      <div>
        <p className="mb-1.5 text-xs font-medium text-slate">Date range</p>
        <div role="group" aria-label="Date range" className="inline-flex rounded-xl border border-mist bg-cloud p-1 text-sm">
          {RANGES.map((r) => (
            <button key={r} type="button" disabled={disabled} aria-pressed={range === r} onClick={() => set({ range: r })} className={`min-h-11 min-w-12 rounded-lg px-3 py-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:cursor-wait disabled:opacity-60 ${range === r ? "bg-navy text-white shadow-sm" : "text-slate hover:bg-card hover:text-heading"}`}>
              {r}d
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 max-w-full">
        <label htmlFor={ownerId} className="mb-1.5 block text-xs font-medium text-slate">Contact owner</label>
        <select id={ownerId} value={owner} disabled={disabled} onChange={(e) => set({ owner: e.target.value })} className="min-h-[54px] max-w-full rounded-xl border border-mist bg-card px-3 py-2 text-sm font-medium text-body outline-none focus-visible:border-trust focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:cursor-wait disabled:opacity-60" aria-label="Owner">
          {currentOwner ? <option value={currentOwner}>My work ({currentOwner})</option> : null}
          <option value="__all__">All owners</option>
          <option value="__none__">Unassigned</option>
          {owners.filter((candidate) => candidate !== currentOwner).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <p className="max-w-64 pb-1 text-xs leading-relaxed text-slate">Date range applies to new contacts and bookings.</p>
      <span role="status" className="sr-only">{pending ? "Updating overview…" : ""}</span>
    </div>
  );
}
