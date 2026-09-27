"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CreditReportFollowup, CreditReportFollowupAssignee } from "@/lib/credit-report-followups";
import { PageTitle } from "./ui";

type QueueResponse = { items: CreditReportFollowup[]; assignees: CreditReportFollowupAssignee[] };
function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function stateLabels(item: CreditReportFollowup, now: number): { label: string; className: string }[] {
  if (item.state === "completed") return [{ label: "Contact completed", className: "bg-green-100 text-green-800" }];
  const labels: { label: string; className: string }[] = [];
  if (!item.assignedTo) labels.push({ label: "Unassigned", className: "bg-amber-100 text-amber-900" });
  const due = Date.parse(item.dueAt);
  if (due <= now) labels.push({ label: "Overdue", className: "bg-red-100 text-red-800" });
  else if (due <= now + 24 * 60 * 60_000) labels.push({ label: "Due within 24 hours", className: "bg-amber-100 text-amber-900" });
  else if (item.assignedTo) labels.push({ label: "Open", className: "bg-blue-100 text-blue-800" });
  return labels;
}

export function CreditReportFollowupsClient() {
  const [queue, setQueue] = useState<QueueResponse>({ items: [], assignees: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const refresh = useCallback(async () => {
    setError("");
    const response = await fetch("/api/crm/credit-report-followups", { cache: "no-store" });
    const payload = await response.json() as QueueResponse | { error?: string };
    if (!response.ok || !("items" in payload)) throw new Error("error" in payload ? payload.error ?? "Queue unavailable." : "Queue unavailable.");
    setQueue(payload);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/crm/credit-report-followups", { cache: "no-store" });
        const payload = await response.json() as QueueResponse | { error?: string };
        if (!response.ok || !("items" in payload)) throw new Error("error" in payload ? payload.error ?? "Queue unavailable." : "Queue unavailable.");
        if (active) setQueue(payload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Queue unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const initialTime = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { active = false; window.clearTimeout(initialTime); window.clearInterval(timer); };
  }, []);

  const openItems = useMemo(() => queue.items.filter((item) => item.state === "open"), [queue.items]);
  const completedItems = useMemo(() => queue.items.filter((item) => item.state === "completed"), [queue.items]);
  const counts = useMemo(() => ({
    unassigned: openItems.filter((item) => !item.assignedTo).length,
    overdue: openItems.filter((item) => Date.parse(item.dueAt) <= now).length,
    soon: openItems.filter((item) => Date.parse(item.dueAt) > now && Date.parse(item.dueAt) <= now + 24 * 60 * 60_000).length,
  }), [now, openItems]);

  async function changeAssignee(item: CreditReportFollowup, assigneeId: string) {
    setBusyId(item.id); setError("");
    try {
      const response = await fetch("/api/crm/credit-report-followups", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, assigneeId: assigneeId || null }),
      });
      if (!response.ok) throw new Error("Assignment could not be saved.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Assignment could not be saved."); }
    finally { setBusyId(null); }
  }

  async function recordOutcome(item: CreditReportFollowup, form: HTMLFormElement) {
    const formData = new FormData(form);
    const localTime = String(formData.get("contactedAt") ?? "");
    if (!localTime) { setError("Enter when the contact attempt happened."); return; }
    setBusyId(item.id); setError("");
    try {
      const response = await fetch("/api/crm/credit-report-followups", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: item.id, contactedAt: new Date(localTime).toISOString(),
          channel: formData.get("channel"), outcome: formData.get("outcome"),
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Contact outcome could not be recorded.");
      form.reset();
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Contact outcome could not be recorded."); }
    finally { setBusyId(null); }
  }

  function card(item: CreditReportFollowup) {
    const statuses = stateLabels(item, now);
    return <article key={item.id} className="rounded-2xl border border-mist bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink"><Link className="hover:underline" href={`/crm/contacts/${item.contactId}`}>{item.contactName}</Link></h3>
          <p className="text-sm text-slate">{item.contactEmail}</p>
        </div>
        <div className="flex flex-wrap gap-2">{statuses.map((status) => <span key={status.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>)}</div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-slate">Contact due</dt><dd className="font-semibold text-ink">{displayDate(item.dueAt)}</dd></div>
        <div><dt className="text-slate">Assigned to</dt><dd className="font-semibold text-ink">{item.assignedName ?? "Unassigned"}</dd></div>
      </dl>
      <div className="mt-4 border-t border-mist pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate">Qualifying report receipts</h4>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-body">
          {item.receipts.map((receipt) => <li key={`${receipt.bureau}-${receipt.uploadedAt}`}>{receipt.bureau}: {displayDate(receipt.uploadedAt)}</li>)}
        </ul>
      </div>
      {item.attempts.length ? <div className="mt-4 border-t border-mist pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate">Contact history</h4>
        <ul className="mt-2 space-y-1 text-sm text-body">
          {item.attempts.map((attempt, index) => <li key={`${attempt.recordedAt}-${index}`}>
            {displayDate(attempt.contactedAt)} · {attempt.channel} · {attempt.outcome.replaceAll("_", " ")} · {attempt.actorName}
          </li>)}
        </ul>
      </div> : null}
      {item.state === "open" ? <div className="mt-4 grid gap-4 border-t border-mist pt-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-body">Assign primary
          <select aria-label={`Assign ${item.contactName}`} value={item.assignedTo ?? ""} disabled={busyId === item.id}
            onChange={(event) => void changeAssignee(item, event.target.value)} className="mt-1 block w-full rounded-lg border border-mist bg-white px-3 py-2">
            <option value="">Unassigned</option>
            {queue.assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name} ({assignee.role})</option>)}
          </select>
        </label>
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void recordOutcome(item, event.currentTarget); }}>
          <label className="text-sm font-medium text-body">Attempt or contact time
            <input aria-label={`Actual contact time for ${item.contactName}`} name="contactedAt" type="datetime-local" required
              className="mt-1 block w-full rounded-lg border border-mist bg-white px-3 py-2" />
          </label>
          <label className="text-sm font-medium text-body">Channel
            <select name="channel" className="mt-1 block w-full rounded-lg border border-mist bg-white px-3 py-2">
              <option value="phone">Phone</option><option value="email">Email</option><option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm font-medium text-body sm:col-span-2">Outcome
            <select name="outcome" className="mt-1 block w-full rounded-lg border border-mist bg-white px-3 py-2">
              <option value="reached">Reached the contact</option><option value="no_answer">No answer</option>
              <option value="left_message">Left a message</option><option value="other">Other attempt</option>
            </select>
          </label>
          <button type="submit" disabled={busyId === item.id} className="rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">
            {busyId === item.id ? "Saving…" : "Record contact outcome"}
          </button>
          <p className="text-xs text-slate sm:col-span-2">Only “Reached the contact” completes the obligation. Other outcomes remain open.</p>
        </form>
      </div> : null}
    </article>;
  }

  return <div className="space-y-6">
    <PageTitle title="Credit report follow-ups" subtitle="Private contact queue from complete credit-report uploads. Deadlines are 48 elapsed hours from the qualifying receipt." />
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-mist bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate">Unassigned</p><p className="mt-1 text-2xl font-bold text-ink">{counts.unassigned}</p></div>
      <div className="rounded-xl border border-mist bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate">Due within 24 hours</p><p className="mt-1 text-2xl font-bold text-ink">{counts.soon}</p></div>
      <div className="rounded-xl border border-mist bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate">Overdue</p><p className="mt-1 text-2xl font-bold text-ink">{counts.overdue}</p></div>
    </div>
    {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {loading ? <p className="text-sm text-slate">Loading private follow-up queue…</p> : null}
    {!loading && openItems.length === 0 ? <p className="rounded-xl border border-mist bg-white p-5 text-sm text-slate">No open credit-report follow-ups.</p> : null}
    <div className="space-y-4">{openItems.map(card)}</div>
    {completedItems.length ? <section className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">Completed contact</h2>
      {completedItems.map(card)}
    </section> : null}
  </div>;
}
