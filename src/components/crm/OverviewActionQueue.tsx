"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ActionItem } from "@/lib/store";
import { Card } from "@/components/crm/ui";
import { UndoNotice, type UndoNoticeState } from "@/components/crm/UndoNotice";
import { ArrowRightIcon, CheckIcon } from "@/components/marketing-v2/Icons";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const actionClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-mist bg-card px-3 py-2 text-xs font-semibold text-body transition-colors hover:bg-cloud focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:opacity-50";

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

export function OverviewActionQueue({ initialItems, owners, canWrite = true, scopeLabel = "Current priorities" }: { initialItems: ActionItem[]; owners: string[]; canWrite?: boolean; scopeLabel?: string }) {
  const interactive = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
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
    if (!item.taskId || !canWrite || !interactive || pending.has(item.id)) return;
    setError(null); setBusy(item.id, true);
    try {
      await api("/api/crm/task", { id: item.taskId, done: true });
      remove(item.id);
      setNotice((current) => ({
        id: (current?.id ?? 0) + 1,
        message: "Task completed.",
        undo: async () => {
          try { await api("/api/crm/task", { id: item.taskId, done: false }); restore(item, index); }
          catch (caught) { setError(caught instanceof Error ? caught.message : "The task could not be restored."); }
        },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This task could not be completed.");
    } finally {
      setBusy(item.id, false);
    }
  }

  async function snooze(item: ActionItem, index: number) {
    if (!item.taskId || !canWrite || !interactive || pending.has(item.id)) return;
    setError(null); setBusy(item.id, true);
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    try {
      await api("/api/crm/task", { id: item.taskId, dueDate: tomorrow.toISOString() });
      remove(item.id);
      setNotice((current) => ({
        id: (current?.id ?? 0) + 1,
        message: "Task snoozed until tomorrow.",
        undo: async () => {
          try { await api("/api/crm/task", { id: item.taskId, dueDate: item.dueDate ?? "" }); restore(item, index); }
          catch (caught) { setError(caught instanceof Error ? caught.message : "The original due date could not be restored."); }
        },
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This task could not be snoozed.");
    } finally {
      setBusy(item.id, false);
    }
  }

  async function assign(item: ActionItem, owner: string) {
    if (!canWrite || !interactive || pending.has(item.id)) return;
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
    <section aria-labelledby="overview-action-queue-title" className="min-w-0">
      <Card className="flex h-full flex-col">
        {notice ? <UndoNotice key={notice.id} notice={notice} onDismiss={() => setNotice(null)} /> : null}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="overview-action-queue-title" className="text-lg font-semibold tracking-tight text-heading">Needs attention</h2>
            <span className="rounded-full border border-mist bg-cloud px-2.5 py-1 text-xs font-semibold tabular-nums text-slate">{items.length} shown</span>
          </div>
          <p className="mt-1 text-sm text-slate">Most urgent work is shown first.</p>
          <p className="mt-1 text-xs leading-relaxed text-slate">Up to 10 items · {scopeLabel}</p>
        </div>
        <Link href="/crm/tasks" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-trust dark:text-gold-deep hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust">Open all tasks <ArrowRightIcon className="h-4 w-4" /></Link>
      </div>
      {error ? <p role="alert" className="mb-3 rounded-lg border border-red/30 bg-red/5 px-3 py-2 text-sm text-red dark:text-[#ffb4aa]">{error}</p> : null}
      {items.length === 0 ? (
        <div className="flex flex-1 items-center gap-4 rounded-xl border border-mist bg-cloud/60 px-4 py-6 sm:px-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-green/20 bg-green/10 text-green"><CheckIcon className="h-5 w-5" /></span>
          <div>
            <p className="text-sm font-semibold text-heading">No priority items right now</p>
            <p className="mt-1 text-sm leading-relaxed text-slate">Your open tasks are still available in Tasks.</p>
          </div>
        </div>
      ) : (
        <ol className="space-y-2">
          {items.map((item, index) => {
            const busy = pending.has(item.id) || !interactive;
            const badgeClass = item.kind === "overdue" ? "bg-red/10 text-red dark:text-[#ffb4aa]" : item.kind === "hot" ? "bg-gold/15 text-gold-deep" : "bg-cloud text-slate";
            const badgeLabel = item.kind === "overdue" ? "Overdue" : item.kind === "hot" ? "Cooling lead" : "Follow-up needed";
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-mist px-3 py-3.5 sm:px-4">
                <div className="flex min-w-0 flex-[1_1_240px] items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-mist bg-cloud text-xs font-semibold tabular-nums text-slate">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={item.href} className="block rounded text-sm font-semibold leading-snug text-body hover:text-trust hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust">{item.title}</Link>
                    <p className="mt-1 text-xs leading-relaxed text-slate">{item.subtitle}</p>
                    <span className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>{badgeLabel}</span>
                  </div>
                </div>
                <div className="flex max-w-full flex-wrap items-center gap-2">
                  {canWrite && item.taskId ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => complete(item, index)} aria-label={`Complete ${item.title}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-green/25 bg-green/10 px-3 py-2 text-xs font-semibold text-green transition-colors hover:bg-green/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:opacity-50"><CheckIcon className="h-4 w-4" />Complete</button>
                      <button type="button" disabled={busy} onClick={() => snooze(item, index)} aria-label={`Snooze ${item.title}`} className={actionClass}>Snooze</button>
                    </>
                  ) : (
                    <Link href={item.href} className={actionClass}>Open contact</Link>
                  )}
                  {canWrite ? <select value={item.owner ?? ""} disabled={busy} onChange={(event) => assign(item, event.target.value)} aria-label={`Assign ${item.title}`} className="min-h-11 max-w-36 rounded-lg border border-mist bg-card px-2 py-2 text-xs font-medium text-body outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:opacity-50">
                    <option value="">Unassigned</option>
                    {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                  </select> : <span className="px-1 text-xs text-slate">{item.owner ?? "Unassigned"}</span>}
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
