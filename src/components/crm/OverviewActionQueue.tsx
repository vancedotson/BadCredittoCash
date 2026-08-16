"use client";

import { useState } from "react";
import Link from "next/link";
import type { ActionItem } from "@/lib/store";
import { Card } from "@/components/crm/ui";
import { UndoNotice, type UndoNoticeState } from "@/components/crm/UndoNotice";

const DAY = 86_400_000;

async function api(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "This work item could not be updated.");
  }
}

function toneColor(tone: string): string {
  return tone === "danger" ? "var(--color-red)" : tone === "warn" ? "var(--color-gold)" : "var(--color-slate)";
}

export function OverviewActionQueue({ initialItems, owners }: { initialItems: ActionItem[]; owners: string[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<UndoNoticeState | null>(null);

  function setBusy(id: string, busy: boolean) {
    setPending((current) => {
      const next = new Set(current);
      if (busy) next.add(id); else next.delete(id);
      return next;
    });
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function restore(item: ActionItem, index: number) {
    setItems((current) => {
      if (current.some((candidate) => candidate.id === item.id)) return current;
      const next = [...current];
      next.splice(Math.min(index, next.length), 0, item);
      return next;
    });
  }

  async function complete(item: ActionItem, index: number) {
    if (!item.taskId) return;
    setError(null); setBusy(item.id, true);
    try {
      await api("/api/crm/task", { id: item.taskId, done: true });
      remove(item.id);
      setNotice((current) => ({
        id: (current?.id ?? 0) + 1,
        message: "Task completed.",
        undo: async () => { await api("/api/crm/task", { id: item.taskId, done: false }); restore(item, index); },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This task could not be completed.");
    } finally {
      setBusy(item.id, false);
    }
  }

  async function snooze(item: ActionItem, index: number) {
    if (!item.taskId) return;
    setError(null); setBusy(item.id, true);
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setTime(tomorrow.getTime() + DAY);
    try {
      await api("/api/crm/task", { id: item.taskId, dueDate: tomorrow.toISOString() });
      remove(item.id);
      setNotice((current) => ({
        id: (current?.id ?? 0) + 1,
        message: "Task snoozed until tomorrow.",
        undo: async () => { await api("/api/crm/task", { id: item.taskId, dueDate: item.dueDate ?? "" }); restore(item, index); },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This task could not be snoozed.");
    } finally {
      setBusy(item.id, false);
    }
  }

  async function assign(item: ActionItem, owner: string) {
    setError(null); setBusy(item.id, true);
    try {
      if (item.taskId) await api("/api/crm/task", { id: item.taskId, owner });
      else if (item.contactId) await api(`/api/crm/contact/${item.contactId}`, { owner });
      setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, owner: owner || undefined } : candidate));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The owner could not be changed.");
    } finally {
      setBusy(item.id, false);
    }
  }

  return (
    <section aria-labelledby="overview-action-queue-title">
      <Card>
        {notice ? <UndoNotice key={notice.id} notice={notice} onDismiss={() => setNotice(null)} /> : null}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="overview-action-queue-title" className="text-lg font-semibold text-heading">Needs attention</h2>
            <span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate">{items.length}</span>
          </div>
          <p className="mt-0.5 text-xs text-slate">Most urgent work is shown first.</p>
        </div>
        <Link href="/crm/tasks" className="text-sm font-medium text-trust hover:underline">Open all tasks</Link>
      </div>
      {error ? <p role="alert" className="mb-3 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-sm text-red">{error}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-slate">All clear. No overdue tasks or cooling leads.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => {
            const busy = pending.has(item.id);
            return (
              <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-mist px-3 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cloud text-xs font-bold tabular-nums text-slate">{index + 1}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: toneColor(item.tone) }} />
                  <div className="min-w-0 flex-1">
                    <Link href={item.href} className="block truncate text-sm font-medium text-body hover:text-trust hover:underline">{item.title}</Link>
                    <div className="truncate text-xs text-slate">{item.subtitle}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0">
                  {item.taskId ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => complete(item, index)} aria-label={`Complete ${item.title}`} className="rounded-lg bg-green px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Complete</button>
                      <button type="button" disabled={busy} onClick={() => snooze(item, index)} aria-label={`Snooze ${item.title}`} className="rounded-lg border border-mist bg-card px-2.5 py-1.5 text-xs text-body hover:bg-cloud disabled:opacity-50">Snooze</button>
                    </>
                  ) : (
                    <Link href={item.href} className="rounded-lg border border-mist bg-card px-2.5 py-1.5 text-xs text-body hover:bg-cloud">Open contact</Link>
                  )}
                  <select value={item.owner ?? ""} disabled={busy} onChange={(event) => assign(item, event.target.value)} aria-label={`Assign ${item.title}`} className="max-w-32 rounded-lg border border-mist bg-card px-2 py-1.5 text-xs text-body disabled:opacity-50">
                    <option value="">Unassigned</option>
                    {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      </Card>
    </section>
  );
}
