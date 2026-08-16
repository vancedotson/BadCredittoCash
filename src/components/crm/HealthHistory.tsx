"use client";

import { useEffect, useState } from "react";
import type { HealthCheck } from "@/lib/system-health";

type Entry = { checkedAt: string; states: Record<string, string> };

export function HealthHistory({ checkedAt, checks }: { checkedAt: string; checks: HealthCheck[] }) {
  const [history, setHistory] = useState<Entry[]>([]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const current = { checkedAt, states: Object.fromEntries(checks.map((check) => [check.key, check.state])) };
      let saved: Entry[] = [];
      try { saved = JSON.parse(localStorage.getItem("crm-health-history") ?? "[]") as Entry[]; } catch { /* ignore invalid history */ }
      const next = [current, ...saved.filter((entry) => entry.checkedAt !== checkedAt)].slice(0, 8);
      try { localStorage.setItem("crm-health-history", JSON.stringify(next)); } catch { /* history remains optional */ }
      setHistory(next);
    });
    return () => cancelAnimationFrame(raf);
  }, [checkedAt, checks]);

  return (
    <div className="rounded-2xl border border-mist bg-card p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-heading">Recent checks</h2>
      <p className="mt-1 text-xs text-slate">Saved in this browser so you can see whether a service changed.</p>
      <ul className="mt-4 space-y-2">
        {history.map((entry, index) => (
          <li key={entry.checkedAt} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-mist bg-cloud px-3 py-2 text-xs">
            <time className="text-slate" dateTime={entry.checkedAt}>{new Date(entry.checkedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}{index === 0 ? " · current" : ""}</time>
            <span className="flex flex-wrap gap-2">{Object.entries(entry.states).map(([key, state]) => <span key={key} className={state === "healthy" ? "text-green" : state === "warning" ? "text-gold-deep" : "text-red"}>{key}: {state}</span>)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
