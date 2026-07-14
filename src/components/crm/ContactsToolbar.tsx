"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";
import { SEGMENTS_IN_ORDER, SEGMENT_LABELS } from "@/lib/segments";

const inputClass = "rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none transition-colors placeholder:text-slate/60 focus:border-trust";

const VIEWS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "hot", label: "Hot leads" },
  { key: "nofollow", label: "No follow-up" },
  { key: "booked", label: "Booked" },
  { key: "clients", label: "Clients" },
  { key: "week", label: "This week" },
];

async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

type SavedView = { name: string; query: string };

export function ContactsToolbar({ owners, tags, sources }: { owners: string[]; tags: string[]; sources: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [modal, setModal] = useState<"add" | "import" | null>(null);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [saved, setSaved] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState("");

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try { setSaved(JSON.parse(localStorage.getItem("crm-contact-views") || "[]")); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  function persist(next: SavedView[]) { setSaved(next); try { localStorage.setItem("crm-contact-views", JSON.stringify(next)); } catch { /* ignore */ } }

  function push(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) { if (v) params.set(k, v); else params.delete(k); }
    params.delete("page");
    router.push(`/crm/contacts?${params.toString()}`);
  }

  const activeChips: Array<{ k: string; label: string }> = [];
  const add = (k: string, label: string) => { const v = sp.get(k); if (v) activeChips.push({ k, label: `${label}: ${v}` }); };
  add("q", "Search"); add("stage", "Stage"); add("segment", "Segment"); add("source", "Source"); add("owner", "Owner"); add("tag", "Tag");
  const viewLabel = VIEWS.find((v) => v.key === sp.get("view"))?.label;
  if (sp.get("view")) activeChips.push({ k: "view", label: `View: ${viewLabel}` });

  return (
    <div className="space-y-3">
      {/* Line A: search + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); push({ q: String(new FormData(e.currentTarget).get("q") ?? "") }); }} className="min-w-[200px] flex-1">
          <input name="q" defaultValue={sp.get("q") ?? ""} placeholder="Search name or email…" className={`${inputClass} w-full`} aria-label="Search" />
        </form>
        <div className="relative">
          <button type="button" onClick={() => setViewsOpen((o) => !o)} className={`${inputClass} flex items-center gap-1`}>Saved views ▾</button>
          {viewsOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setViewsOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-mist bg-card p-2 shadow-card">
                {saved.length === 0 ? <p className="px-2 py-1.5 text-xs text-slate">No saved views yet.</p> : saved.map((v) => (
                  <div key={v.name} className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => { router.push(`/crm/contacts?${v.query}`); setViewsOpen(false); }} className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm text-body hover:bg-cloud">{v.name}</button>
                    <button type="button" onClick={() => persist(saved.filter((s) => s.name !== v.name))} className="px-1 text-slate hover:text-red" aria-label="Delete view">×</button>
                  </div>
                ))}
                <div className="mt-1 flex gap-1 border-t border-mist pt-2">
                  <input value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="Save current as…" className="min-w-0 flex-1 rounded-lg border border-mist px-2 py-1.5 text-sm outline-none focus:border-trust" />
                  <button type="button" onClick={() => { const n = newViewName.trim(); if (n) { persist([...saved.filter((s) => s.name !== n), { name: n, query: sp.toString() }]); setNewViewName(""); } }} className="rounded-lg bg-gold px-2 py-1.5 text-xs font-semibold text-ink hover:bg-gold-deep">Save</button>
                </div>
              </div>
            </>
          ) : null}
        </div>
        <button type="button" onClick={() => setModal("add")} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep">+ Add contact</button>
        <button type="button" onClick={() => setModal("import")} className={inputClass}>Import CSV</button>
      </div>

      {/* Line B: quick views */}
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((v) => {
          const active = (sp.get("view") ?? "") === v.key;
          return <button key={v.key} type="button" onClick={() => push({ view: v.key })} className={`rounded-full px-3 py-1 text-sm ${active ? "bg-navy text-white" : "border border-mist bg-card text-slate hover:bg-cloud"}`}>{v.label}</button>;
        })}
      </div>

      {/* Line C: filters */}
      <div className="flex flex-wrap gap-2">
        <select value={sp.get("stage") ?? ""} onChange={(e) => push({ stage: e.target.value })} className={inputClass} aria-label="Stage"><option value="">All stages</option>{STAGES_IN_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s as Stage]}</option>)}</select>
        <select value={sp.get("segment") ?? ""} onChange={(e) => push({ segment: e.target.value })} className={inputClass} aria-label="Segment"><option value="">All segments</option>{SEGMENTS_IN_ORDER.map((s) => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}</select>
        <select value={sp.get("source") ?? ""} onChange={(e) => push({ source: e.target.value })} className={inputClass} aria-label="Source"><option value="">All sources</option>{sources.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select>
        <select value={sp.get("owner") ?? ""} onChange={(e) => push({ owner: e.target.value })} className={inputClass} aria-label="Owner"><option value="">All owners</option><option value="__none__">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        {tags.length ? <select value={sp.get("tag") ?? ""} onChange={(e) => push({ tag: e.target.value })} className={inputClass} aria-label="Tag"><option value="">All tags</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}</select> : null}
        <select value={sp.get("pageSize") ?? "25"} onChange={(e) => push({ pageSize: e.target.value })} className={inputClass} aria-label="Page size"><option value="25">25 / page</option><option value="50">50 / page</option><option value="100">100 / page</option></select>
      </div>

      {/* Line D: active filter chips */}
      {activeChips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((c) => (
            <button key={c.k} type="button" onClick={() => push({ [c.k]: "" })} className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-1 text-xs text-trust hover:opacity-80">{c.label}<span className="text-trust/70">×</span></button>
          ))}
          <button type="button" onClick={() => router.push("/crm/contacts")} className="text-xs text-slate hover:text-heading hover:underline">Clear all</button>
        </div>
      ) : null}

      {modal === "add" ? <AddContactModal owners={owners} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} /> : null}
      {modal === "import" ? <ImportModal onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} /> : null}
    </div>
  );
}

const field = "w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust";

function AddContactModal({ owners, onClose, onDone }: { owners: string[]; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ name: "", email: "", phone: "", source: "manual", stage: "new" as Stage, owner: "" });
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) { setErr("Name and a valid email are required."); return; }
    setPending(true); setErr(null);
    try { await api("/api/crm/contact", "POST", v); onDone(); } catch { setErr("Could not create the contact."); setPending(false); }
  }
  return (
    <Modal title="Add contact" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Name" className={field} />
        <input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="Email" className={field} />
        <input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="Phone (optional)" className={field} />
        <div className="flex gap-3">
          <input value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} placeholder="Source" className={field} />
          <select value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as Stage })} className={field}>{STAGES_IN_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select>
        </div>
        <select value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} className={field}><option value="">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        {err ? <p className="text-sm text-red">{err}</p> : null}
        <ModalActions pending={pending} onClose={onClose} label="Add contact" />
      </form>
    </Modal>
  );
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur); return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => { const cells = parseLine(l); const o: Record<string, string> = {}; headers.forEach((h, i) => (o[h] = (cells[i] ?? "").trim())); return o; });
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    f.text().then((text) => setRows(parseCsv(text)));
  }
  async function submit() {
    if (!rows.length) return;
    setPending(true);
    const contacts = rows.map((r) => ({ name: r.name, email: r.email, phone: r.phone, source: r.source, owner: r.owner }));
    try { const res = await api("/api/crm/import", "POST", { contacts }); setResult(`Imported ${res.imported}, skipped ${res.skipped}.`); setTimeout(onDone, 900); } catch { setResult("Import failed."); setPending(false); }
  }
  return (
    <Modal title="Import contacts (CSV)" onClose={onClose}>
      <p className="mb-3 text-sm text-slate">CSV with columns: name, email, phone, source, owner. Existing emails are updated.</p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} className="w-full text-sm" />
      {rows.length ? <p className="mt-3 text-sm text-body">{rows.length} rows detected.</p> : null}
      {result ? <p className="mt-3 text-sm text-green">{result}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Cancel</button>
        <button type="button" disabled={pending || !rows.length} onClick={submit} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Importing…" : "Import"}</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-heading">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ pending, onClose, label }: { pending: boolean; onClose: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Cancel</button>
      <button type="submit" disabled={pending} className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Saving…" : label}</button>
    </div>
  );
}
