"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CrmProfile, CrmPrefs, NotifyPrefs, TrashedContact } from "@/lib/store";

const INPUT = "min-w-0 flex-1 rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust";
const BTN = "rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50";
const BTN_GHOST = "rounded-lg border border-mist px-3 py-2 text-sm text-body hover:border-trust";

async function post(body: Record<string, unknown>): Promise<void> {
  const response = await fetch("/api/crm/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "The setting could not be saved.");
  }
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "The setting could not be saved.";
}

function InlineError({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-lg border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">{message} Your unsaved choice is still here.</p> : null;
}

function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const flash = () => { setOn(true); setTimeout(() => setOn(false), 1800); };
  return [on, flash];
}

function Saved({ show }: { show: boolean }) {
  return show ? <span className="text-xs font-medium text-green">Saved ✓</span> : null;
}

// ------------------------------------------------------------------ Profile

const PROFILE_FIELDS: Array<{ key: keyof CrmProfile; label: string; hint?: string; placeholder?: string }> = [
  { key: "brandName", label: "Brand name", hint: "Shown to contacts and on outgoing email." },
  { key: "bookingUrl", label: "Booking link", hint: "Fills {{call_link}} in every sequence." },
  { key: "trainingUrl", label: "Training link", hint: "Fills {{watch_link}} in every sequence." },
  { key: "fromName", label: "From name", hint: "The sender name on sequence email." },
  { key: "replyTo", label: "Reply-to email", hint: "Where replies land." },
  { key: "timezone", label: "Timezone", hint: "Used for scheduling and the calendar.", placeholder: "America/Chicago" },
];

export function ProfileForm({ profile }: { profile: CrmProfile }) {
  const router = useRouter();
  const [form, setForm] = useState<CrmProfile>(profile);
  const [busy, setBusy] = useState(false);
  const [saved, flash] = useFlash();
  const [error, setError] = useState("");
  const dirty = PROFILE_FIELDS.some((f) => form[f.key] !== profile[f.key]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await post({ action: "update-profile", profile: form });
      flash();
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {PROFILE_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs font-medium text-heading">{f.label}</span>
            <input value={form[f.key]} aria-label={f.label} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust" />
            {f.hint ? <span className="mt-1 block text-xs text-slate">{f.hint}</span> : null}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-mist pt-4">
        <button type="button" onClick={save} disabled={busy || !dirty} className={BTN}>Save profile</button>
        <Saved show={saved} />
      </div>
      <InlineError message={error} />
    </div>
  );
}

// ------------------------------------------------------------------- Owners

type Workload = { owner: string; contacts: number; openTasks: number };

export function OwnerManager({ workloads, defaultOwner, ownerNames }: { workloads: Workload[]; defaultOwner?: string; ownerNames: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [reassign, setReassign] = useState("");
  const [error, setError] = useState("");

  async function saveAction(body: Record<string, unknown>, onSaved: () => void) {
    setError("");
    try {
      await post(body);
      onSaved();
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function add() {
    if (!name.trim()) return;
    await saveAction({ action: "add-owner", value: name.trim() }, () => setName(""));
  }
  async function rename(from: string) {
    if (!editVal.trim() || editVal.trim() === from) return;
    await saveAction({ action: "rename-owner", value: from, to: editVal.trim() }, () => setEditing(null));
  }
  async function remove(owner: string) {
    await saveAction(
      { action: "remove-owner", value: owner, reassignTo: reassign || undefined },
      () => { setRemoving(null); setReassign(""); },
    );
  }
  async function setDefault(owner: string) {
    await saveAction({ action: "set-default-owner", value: owner === defaultOwner ? "" : owner }, () => undefined);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-slate">New contacts are assigned to the default owner.</span>
      </div>
      <ul className="mb-3 space-y-2">
        {workloads.map((w) => {
          const isDefault = w.owner === defaultOwner;
          const others = ownerNames.filter((o) => o !== w.owner);
          return (
            <li key={w.owner} className="rounded-lg border border-mist px-3 py-3 text-sm">
              {editing === w.owner ? (
                <div className="flex items-center gap-2">
                  <input value={editVal} autoFocus onChange={(e) => setEditVal(e.target.value)} className={INPUT} />
                  <button type="button" onClick={() => rename(w.owner)} className={BTN}>Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="text-slate hover:text-body">Cancel</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-body">{w.owner}</span>
                      {isDefault ? <span className="rounded-full bg-sky px-2 py-0.5 text-[10px] font-medium text-trust">Default</span> : null}
                    </div>
                    <div className="text-xs text-slate">{w.contacts} contact{w.contacts === 1 ? "" : "s"} · {w.openTasks} open task{w.openTasks === 1 ? "" : "s"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs sm:justify-end">
                    <button type="button" onClick={() => setDefault(w.owner)} className="text-slate hover:text-trust">{isDefault ? "Unset" : "Make default"}</button>
                    <button type="button" onClick={() => { setEditing(w.owner); setEditVal(w.owner); }} className="text-slate hover:text-trust">Rename</button>
                    <button type="button" onClick={() => { setRemoving(removing === w.owner ? null : w.owner); setReassign(""); }} className="text-slate hover:text-red">Remove</button>
                  </div>
                </div>
              )}
              {removing === w.owner ? (
                <div className="mt-3 flex flex-col items-stretch gap-2 rounded-lg border border-red/20 bg-red/5 px-3 py-3 text-xs sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="text-slate">Reassign their {w.contacts} contact{w.contacts === 1 ? "" : "s"} and {w.openTasks} task{w.openTasks === 1 ? "" : "s"} to:</span>
                  <select value={reassign} onChange={(e) => setReassign(e.target.value)} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs">
                    <option value="">Unassigned</option>
                    {others.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <button type="button" onClick={() => remove(w.owner)} className="rounded-lg bg-red px-2 py-1 font-medium text-white">Remove owner</button>
                  <button type="button" onClick={() => setRemoving(null)} className="text-slate hover:text-body">Cancel</button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an owner…" className={INPUT} />
        <button type="submit" className={BTN}>Add</button>
      </form>
      <div className="mt-3"><InlineError message={error} /></div>
    </div>
  );
}

// --------------------------------------------------------------------- Tags

type TagRow = { tag: string; count: number };

export function TagManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const [create, setCreate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [merging, setMerging] = useState<string | null>(null);
  const [mergeInto, setMergeInto] = useState("");
  const [error, setError] = useState("");

  async function saveAction(body: Record<string, unknown>, onSaved: () => void) {
    setError("");
    try {
      await post(body);
      onSaved();
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function add() {
    if (!create.trim()) return;
    await saveAction({ action: "create-tag", value: create.trim() }, () => setCreate(""));
  }
  async function rename(from: string) {
    if (!editVal.trim() || editVal.trim() === from) return;
    await saveAction({ action: "rename-tag", value: from, to: editVal.trim() }, () => setEditing(null));
  }
  async function merge(from: string) {
    if (!mergeInto || mergeInto === from) return;
    await saveAction(
      { action: "merge-tag", value: from, to: mergeInto },
      () => { setMerging(null); setMergeInto(""); },
    );
  }
  async function del(tag: string, count: number) {
    if (count > 0 && !window.confirm(`Delete #${tag}? It will be removed from ${count} contact${count === 1 ? "" : "s"}.`)) return;
    await saveAction({ action: "delete-tag", value: tag }, () => undefined);
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input value={create} onChange={(e) => setCreate(e.target.value)} placeholder="Create a tag…" className={INPUT} />
        <button type="submit" className={BTN}>Create</button>
      </form>
      {tags.length === 0 ? (
        <p className="text-sm text-slate">No tags yet. Create one above or tag contacts from the Contacts list.</p>
      ) : (
        <ul className="space-y-2">
          {tags.map((t) => {
            const others = tags.filter((x) => x.tag !== t.tag).map((x) => x.tag);
            return (
              <li key={t.tag} className="rounded-lg border border-mist px-3 py-2 text-sm">
                {editing === t.tag ? (
                  <div className="flex items-center gap-2">
                    <input value={editVal} autoFocus onChange={(e) => setEditVal(e.target.value)} className={INPUT} />
                    <button type="button" onClick={() => rename(t.tag)} className={BTN}>Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="text-slate hover:text-body">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-medium text-body">#{t.tag} <span className="font-normal text-slate">· {t.count} contact{t.count === 1 ? "" : "s"}</span></span>
                    <details className="relative shrink-0">
                      <summary aria-label={`Actions for ${t.tag}`} className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg border border-mist text-lg text-body hover:border-trust hover:bg-sky">⋯</summary>
                      <div className="absolute right-0 z-20 mt-1 grid min-w-32 overflow-hidden rounded-lg border border-trust/30 bg-card p-1 text-xs shadow-xl">
                        <button type="button" onClick={() => { setEditing(t.tag); setEditVal(t.tag); }} className="rounded-md px-3 py-2 text-left text-body hover:bg-cloud">Rename</button>
                        {others.length ? <button type="button" onClick={() => { setMerging(merging === t.tag ? null : t.tag); setMergeInto(""); }} className="rounded-md px-3 py-2 text-left text-body hover:bg-cloud">Merge</button> : null}
                        <button type="button" onClick={() => del(t.tag, t.count)} className="rounded-md px-3 py-2 text-left text-red hover:bg-red/10">Delete</button>
                      </div>
                    </details>
                  </div>
                )}
                {merging === t.tag ? (
                  <div className="mt-2 flex flex-col items-stretch gap-2 rounded-lg bg-cloud px-3 py-3 text-xs sm:flex-row sm:flex-wrap sm:items-center">
                    <span className="text-slate">Merge #{t.tag} into:</span>
                    <select value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} className="rounded-lg border border-mist bg-card px-2 py-1 text-xs">
                      <option value="">Choose a tag…</option>
                      {others.map((o) => <option key={o} value={o}>#{o}</option>)}
                    </select>
                    <button type="button" onClick={() => merge(t.tag)} disabled={!mergeInto} className={BTN + " px-2 py-1"}>Merge</button>
                    <button type="button" onClick={() => setMerging(null)} className="text-slate hover:text-body">Cancel</button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3"><InlineError message={error} /></div>
    </div>
  );
}

// --------------------------------------------------------------- Appearance

function applyTheme(theme: CrmPrefs["theme"]) {
  const root = document.documentElement;
  if (theme === "system") {
    try { localStorage.removeItem("theme"); } catch { /* ignore */ }
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", dark ? "dark" : "light");
  } else {
    try { localStorage.setItem("theme", theme); } catch { /* ignore */ }
    root.setAttribute("data-theme", theme);
  }
}

const PAGE_SIZES = [10, 25, 50, 100];
const VIEWS = [
  { value: "all", label: "All contacts" },
  { value: "hot", label: "Hot" },
  { value: "no-followup", label: "No follow-up" },
  { value: "booked", label: "Booked" },
  { value: "clients", label: "Clients" },
];

export function AppearanceForm({ prefs }: { prefs: CrmPrefs }) {
  const router = useRouter();
  const [theme, setTheme] = useState<CrmPrefs["theme"]>(prefs.theme);
  const [pageSize, setPageSize] = useState(prefs.defaultContactsPageSize);
  const [view, setView] = useState(prefs.defaultContactsView);
  const [saved, flash] = useFlash();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pickTheme(t: CrmPrefs["theme"]) {
    const previous = theme;
    setTheme(t);
    applyTheme(t);
    setBusy(true);
    setError("");
    try {
      await post({ action: "update-prefs", prefs: { theme: t } });
      flash();
    } catch (cause) {
      setTheme(previous);
      applyTheme(previous);
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveDefaults() {
    setBusy(true);
    setError("");
    try {
      await post({ action: "update-prefs", prefs: { defaultContactsPageSize: pageSize, defaultContactsView: view } });
      flash();
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-medium text-heading">Theme</div>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button key={t} type="button" disabled={busy} onClick={() => void pickTheme(t)} className={`rounded-lg border px-3 py-2 text-sm capitalize disabled:opacity-60 ${theme === t ? "border-trust bg-sky text-trust" : "border-mist text-body hover:border-trust"}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-heading">Default contacts per page</span>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-heading">Default contacts view</span>
          <select value={view} onChange={(e) => setView(e.target.value)} className="w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body">
            {VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={saveDefaults} className={BTN}>Save defaults</button>
        <Saved show={saved} />
      </div>
      <InlineError message={error} />
    </div>
  );
}

// ------------------------------------------------------------ Notifications

const NOTIFY_ITEMS: Array<{ key: keyof NotifyPrefs; label: string; hint: string }> = [
  { key: "overdueTasks", label: "Overdue tasks", hint: "Surface tasks past their due date." },
  { key: "coolingLeads", label: "Cooling hot leads", hint: "Warm leads going stale without a touch." },
  { key: "noFollowUp", label: "No next step", hint: "Contacts with no scheduled follow-up." },
  { key: "newBookings", label: "New bookings", hint: "Someone booked a call." },
  { key: "highIntentRegistrations", label: "High-intent registrations", hint: "Someone watches most of the training or starts booking." },
];

export function NotificationForm({ notify }: { notify: NotifyPrefs }) {
  const [state, setState] = useState<NotifyPrefs>(notify);
  const [saved, flash] = useFlash();
  const [pending, setPending] = useState<keyof NotifyPrefs | null>(null);
  const [error, setError] = useState("");

  async function toggle(key: keyof NotifyPrefs) {
    const previous = state;
    const next = { ...state, [key]: !state[key] };
    setState(next);
    setPending(key);
    setError("");
    try {
      await post({ action: "update-prefs", prefs: { notify: next } });
      flash();
    } catch (cause) {
      setState(previous);
      setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center gap-3"><span className="text-xs text-slate">Which conditions surface in the notifications bell.</span><Saved show={saved} /></div>
      {NOTIFY_ITEMS.map((it) => (
        <div key={it.key} className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-mist px-3 py-2">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-body">{it.label}</span>
            <span className="block text-xs text-slate">{it.hint}</span>
          </span>
          <button type="button" role="switch" aria-label={it.label} aria-checked={state[it.key]} disabled={pending !== null} onClick={() => void toggle(it.key)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${state[it.key] ? "bg-trust" : "bg-mist"}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow-sm transition-all ${state[it.key] ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>
      ))}
      <div className="pt-2"><InlineError message={error} /></div>
    </div>
  );
}

// -------------------------------------------------------------- Data / danger

type Status = { backend: string; seedVersion: number; counts: Record<string, number> };

export function DataManagement({ status }: { status: Status }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [backup, setBackup] = useState<unknown>(null);
  const [preview, setPreview] = useState<{ exportedAt: string; counts: Record<string, number> } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function previewRestore() {
    if (!file) return;
    setWorking(true); setError(""); setMessage(""); setPreview(null);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const response = await fetch("/api/crm/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup: parsed, preview: true }) });
      const payload = await response.json() as { error?: string; exportedAt?: string; counts?: Record<string, number> };
      if (!response.ok || !payload.exportedAt || !payload.counts) throw new Error(payload.error ?? "Could not validate this backup.");
      setBackup(parsed); setPreview({ exportedAt: payload.exportedAt, counts: payload.counts });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read this backup."); }
    setWorking(false);
  }

  async function restoreBackup() {
    if (!backup || confirmation !== "RESTORE VANCE CRM") return;
    setWorking(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/crm/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup, confirmation }) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Restore failed safely; current data was not partially replaced.");
      setMessage("Backup restored. Pending emails from the snapshot were cancelled for safety.");
      setConfirmation("");
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <div><h3 className="text-sm font-semibold text-heading">Data overview</h3><p className="mt-1 text-xs text-slate">Current storage and record totals.</p></div>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-mist bg-cloud/50 p-3 sm:grid-cols-3">
        <div><dt className="text-xs text-slate">Backend</dt><dd className="text-sm font-medium text-body">{status.backend}</dd></div>
        <div><dt className="text-xs text-slate">Seed version</dt><dd className="text-sm font-medium text-body">v{status.seedVersion}</dd></div>
        {Object.entries(status.counts).map(([k, v]) => (
          <div key={k}><dt className="text-xs capitalize text-slate">{k}</dt><dd className="text-sm font-medium text-body">{v}</dd></div>
        ))}
      </dl>
      <div><h3 className="mb-2 text-sm font-semibold text-heading">Export &amp; backup</h3><div className="flex flex-wrap gap-2">
        <a href="/api/crm/backup" className={BTN_GHOST}>Download full backup (JSON)</a>
        <a href="/api/crm/export" className={BTN_GHOST}>Export contacts (CSV)</a>
      </div></div>
      <p className="rounded-lg border border-mist bg-cloud/50 p-3 text-xs text-slate">
        The full backup contains CRM records and settings, but never passwords, API keys, or Google credentials. Download one before planned migrations or cleanup.
      </p>
      <div className="space-y-3 rounded-xl border border-red/30 bg-red/5 p-4">
        <div><div className="mb-1 inline-flex rounded-full bg-red/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red">Danger zone</div><h3 className="text-sm font-semibold text-heading">Restore a full backup</h3><p className="mt-1 text-xs text-slate">Validation is read-only. The final restore replaces current CRM records in one database transaction.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept="application/json,.json" aria-label="Choose backup file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setBackup(null); setConfirmation(""); setError(""); }} className="max-w-full text-sm text-body file:mr-3 file:rounded-lg file:border file:border-mist file:bg-card file:px-3 file:py-2 file:text-sm file:text-body" />
          <button type="button" disabled={!file || working} onClick={previewRestore} className={BTN_GHOST}>{working && !preview ? "Validating…" : "Validate backup"}</button>
        </div>
        {preview ? <div className="space-y-3 rounded-lg border border-gold/40 bg-gold/5 p-3 text-sm">
          <p><span className="font-semibold">Valid backup</span> from {new Date(preview.exportedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="text-xs text-slate">{Object.entries(preview.counts).map(([key, count]) => `${key}: ${count}`).join(" · ")}</p>
          <label className="block"><span className="mb-1 block text-xs text-slate">Type <strong>RESTORE VANCE CRM</strong> to replace current CRM data.</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={INPUT} /></label>
          <button type="button" disabled={working || confirmation !== "RESTORE VANCE CRM"} onClick={restoreBackup} className="rounded-lg bg-red px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{working ? "Restoring…" : "Restore this backup"}</button>
        </div> : null}
        {error ? <p role="alert" className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg bg-green/10 px-3 py-2 text-sm text-green">{message}</p> : null}
      </div>
    </div>
  );
}

export function ContactTrash({ contacts }: { contacts: TrashedContact[] }) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function restore(contact: TrashedContact) {
    setRestoring(contact.id);
    setError("");
    try {
      const response = await fetch("/api/crm/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not restore this contact.");
      router.refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate">Deleted contacts and their related CRM history remain here until restored.</p><span className="rounded-full bg-cloud px-2 py-1 text-xs font-medium text-body">{contacts.length} deleted</span></div>
      {contacts.length ? <ul className="divide-y divide-mist rounded-xl border border-mist">
        {contacts.map((contact) => <li key={contact.id} className="flex flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="font-medium text-body">{contact.name}</div>
            <div className="truncate text-xs text-slate">{contact.email}</div>
            <div className="mt-1 text-[11px] text-slate">Deleted {new Date(contact.deletedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}{contact.deletedBy ? ` by ${contact.deletedBy}` : ""}</div>
          </div>
          <button type="button" disabled={restoring === contact.id} onClick={() => restore(contact)} className={`${BTN} sm:shrink-0`}>
            {restoring === contact.id ? "Restoring…" : "Restore"}
          </button>
        </li>)}
      </ul> : <p className="rounded-xl border border-mist bg-cloud p-4 text-sm text-slate">Trash is empty.</p>}
    </div>
  );
}
