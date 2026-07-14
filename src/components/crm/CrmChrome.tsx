"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { NavData } from "@/lib/store";
import { LightbulbIcon, PersonIcon, DollarIcon, CheckIcon, RefreshIcon, DocumentIcon, ShieldIcon, ImageIcon, BellIcon, SunIcon, MoonIcon } from "@/components/marketing-v2/Icons";
import { CommandPalette } from "./CommandPalette";
import { AddContactModal, AddTaskModal } from "./CrmModals";

type Pin = { id: string; name: string };

export function CrmChrome({ nav, children }: { nav: NavData; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [palette, setPalette] = useState(false);
  const [quick, setQuick] = useState<"contact" | "task" | null>(null);
  const [notif, setNotif] = useState(false);
  const [account, setAccount] = useState(false);
  const [help, setHelp] = useState(false);
  const [recent, setRecent] = useState<Pin[]>([]);
  const [pinned, setPinned] = useState<Pin[]>([]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCollapsed(localStorage.getItem("crm-collapsed") === "1");
      setDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try { setRecent(JSON.parse(localStorage.getItem("crm-recent") || "[]")); } catch { /* ignore */ }
      try { setPinned(JSON.parse(localStorage.getItem("crm-pinned") || "[]")); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  useEffect(() => {
    let g = false; let gt: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); return; }
      if (typing) return;
      if (e.key === "?") { setHelp(true); return; }
      if (e.key.toLowerCase() === "g") { g = true; clearTimeout(gt); gt = setTimeout(() => (g = false), 800); return; }
      if (g) { g = false; const map: Record<string, string> = { c: "/crm/contacts", p: "/crm/pipeline", t: "/crm/tasks", o: "/crm", a: "/crm/activity", s: "/crm/settings", l: "/crm/calendar" }; const d = map[e.key.toLowerCase()]; if (d) router.push(d); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  function toggleDark() { const nd = !dark; document.documentElement.setAttribute("data-theme", nd ? "dark" : "light"); try { localStorage.setItem("theme", nd ? "dark" : "light"); } catch { /* ignore */ } setDark(nd); }
  function toggleCollapse() { setCollapsed((v) => { const n = !v; try { localStorage.setItem("crm-collapsed", n ? "1" : "0"); } catch { /* ignore */ } return n; }); }

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  type NavItemT = { href: string; label: string; Icon: (p: { className?: string }) => React.ReactElement; exact?: boolean; badge?: number; tone?: "red" | "info" };
  const PRIMARY: NavItemT[] = [
    { href: "/crm", label: "Overview", Icon: LightbulbIcon, exact: true, badge: nav.counts.needsAttention, tone: "info" as const },
    { href: "/crm/contacts", label: "Contacts", Icon: PersonIcon },
    { href: "/crm/pipeline", label: "Pipeline", Icon: DollarIcon },
    { href: "/crm/tasks", label: "Tasks", Icon: CheckIcon, badge: nav.counts.overdueTasks, tone: "red" as const },
  ];
  const SECONDARY: NavItemT[] = [
    { href: "/crm/activity", label: "Activity", Icon: RefreshIcon },
    { href: "/crm/calendar", label: "Calendar", Icon: ImageIcon },
    { href: "/crm/sequences", label: "Sequences", Icon: DocumentIcon },
    { href: "/crm/settings", label: "Settings", Icon: ShieldIcon },
  ];
  const owner = nav.owners[0] ?? "You";

  const navItem = (it: { href: string; label: string; Icon: (p: { className?: string }) => React.ReactElement; exact?: boolean; badge?: number; tone?: "red" | "info" }) => {
    const active = isActive(it.href, it.exact);
    return (
      <Link key={it.href} href={it.href} title={collapsed ? it.label : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
        <it.Icon className="h-4 w-4 shrink-0" />
        {!collapsed ? <span className="flex-1">{it.label}</span> : null}
        {it.badge ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${it.tone === "red" ? "bg-red text-white" : "bg-gold text-ink"} ${collapsed ? "absolute right-1 top-1" : ""}`}>{it.badge}</span> : null}
      </Link>
    );
  };

  return (
    <div className="crm-scope flex min-h-screen bg-cloud">
      {/* Desktop sidebar */}
      <aside className={`crm-sidebar sticky top-0 hidden h-screen shrink-0 flex-col text-white md:flex ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed ? <span className="flex items-center gap-2"><span className="font-heading text-lg font-bold text-white">Vance</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gold">CRM</span></span> : <span className="font-heading text-lg font-bold text-gold">V</span>}
          <button type="button" onClick={toggleCollapse} aria-label="Collapse" className="text-white/50 hover:text-white">{collapsed ? "»" : "«"}</button>
        </div>

        {/* Global tools */}
        <div className="space-y-1.5 px-3 pb-2">
          <button type="button" onClick={() => setPalette(true)} className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10" title="Search (⌘K)">
            <span className="text-white/50">⌕</span>{!collapsed ? <><span className="flex-1 text-left">Search</span><kbd className="rounded bg-white/10 px-1 text-[10px]">⌘K</kbd></> : null}
          </button>
          {!collapsed ? (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setQuick("contact")} className="flex-1 rounded-lg bg-gold px-2 py-1.5 text-xs font-semibold text-ink hover:bg-gold-deep">+ Contact</button>
              <button type="button" onClick={() => setQuick("task")} className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/20">+ Task</button>
              <div className="relative">
                <button type="button" onClick={() => setNotif((o) => !o)} aria-label="Notifications" className="relative grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"><BellIcon className="h-4 w-4" />{nav.counts.needsAttention ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red px-1 text-[10px] font-semibold text-white">{nav.counts.needsAttention}</span> : null}</button>
                {notif ? <NotifDropdown items={nav.notifications} onClose={() => setNotif(false)} /> : null}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setQuick("contact")} className="grid w-full place-items-center rounded-lg bg-gold py-2 text-ink" title="New">+</button>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <div className="space-y-1">{PRIMARY.map(navItem)}</div>
          <div className="my-2 border-t border-white/10" />
          <div className="space-y-1">{SECONDARY.map(navItem)}</div>

          {!collapsed && pinned.length ? (<><div className="mb-1 mt-4 px-3 text-[10px] uppercase tracking-wide text-white/40">Pinned</div>{pinned.slice(0, 5).map((p) => <Link key={p.id} href={`/crm/contacts/${p.id}`} className="block truncate rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white">★ {p.name}</Link>)}</>) : null}
          {!collapsed && recent.length ? (<><div className="mb-1 mt-4 px-3 text-[10px] uppercase tracking-wide text-white/40">Recent</div>{recent.slice(0, 5).map((p) => <Link key={p.id} href={`/crm/contacts/${p.id}`} className="block truncate rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/5 hover:text-white">{p.name}</Link>)}</>) : null}
        </nav>

        {/* Account */}
        <div className="relative border-t border-white/10 px-3 py-3">
          <button type="button" onClick={() => setAccount((o) => !o)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold text-white">{owner[0]}</span>
            {!collapsed ? <span className="min-w-0 flex-1 truncate text-sm text-white/80">{owner}</span> : null}
          </button>
          {account ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAccount(false)} />
              <div className="absolute bottom-14 left-3 z-20 w-52 rounded-xl border border-mist bg-card py-1 text-sm shadow-card">
                <div className="px-3 py-1.5 text-xs text-slate">Signed in as <span className="text-body">{owner}</span></div>
                <button type="button" onClick={() => { toggleDark(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body hover:bg-cloud">{dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}{dark ? "Light mode" : "Dark mode"}</button>
                <button type="button" onClick={() => { setHelp(true); setAccount(false); }} className="block w-full px-3 py-1.5 text-left text-body hover:bg-cloud">Keyboard shortcuts</button>
                <Link href="/crm/settings" onClick={() => setAccount(false)} className="block px-3 py-1.5 text-body hover:bg-cloud">Settings</Link>
                <Link href="/" className="block px-3 py-1.5 text-body hover:bg-cloud">View site ↗</Link>
              </div>
            </>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="crm-topbar sticky top-0 z-20 text-white md:hidden">
          <div className="flex h-14 items-center justify-between gap-2 px-4">
            <span className="flex items-center gap-2"><span className="font-heading font-bold text-white">Vance</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gold">CRM</span></span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPalette(true)} aria-label="Search" className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">⌕</button>
              <button type="button" onClick={() => setQuick("contact")} aria-label="New" className="grid h-8 w-8 place-items-center rounded-lg bg-gold text-ink">+</button>
              <button type="button" onClick={toggleDark} aria-label="Theme" className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">{dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}</button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {[...PRIMARY, ...SECONDARY].map((it) => { const active = isActive(it.href, it.exact); return <Link key={it.href} href={it.href} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-white/12 text-white" : "text-white/70"}`}><it.Icon className="h-4 w-4" />{it.label}{it.badge ? <span className="rounded-full bg-red px-1.5 text-[10px] font-semibold text-white">{it.badge}</span> : null}</Link>; })}
          </nav>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>

      {/* Overlays */}
      {palette ? <CommandPalette contacts={nav.contacts} onClose={() => setPalette(false)} onNewContact={() => setQuick("contact")} onNewTask={() => setQuick("task")} /> : null}
      {quick === "contact" ? <AddContactModal owners={nav.owners} onClose={() => setQuick(null)} onDone={() => {}} /> : null}
      {quick === "task" ? <AddTaskModal contacts={nav.contacts} owners={nav.owners} onClose={() => setQuick(null)} onDone={() => {}} /> : null}
      {help ? <ShortcutsHelp onClose={() => setHelp(false)} /> : null}
    </div>
  );
}

function NotifDropdown({ items, onClose }: { items: NavData["notifications"]; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 top-11 z-20 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-mist bg-card text-left shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-mist px-3 py-2.5">
          <span className="text-sm font-semibold text-heading">Needs attention</span>
          <span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate">{items.length}</span>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? <p className="px-2 py-6 text-center text-sm text-slate">All clear. Nothing needs attention right now.</p> : items.map((a) => (
            <Link key={a.id} href={a.href} onClick={onClose} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-cloud">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.tone === "danger" ? "var(--color-red)" : a.tone === "warn" ? "var(--color-gold)" : "var(--color-slate)" }} />
              <span className="min-w-0"><span className="block truncate text-sm text-body">{a.title}</span><span className="block truncate text-xs text-slate">{a.subtitle}</span></span>
            </Link>
          ))}
        </div>
        {items.length ? <Link href="/crm" onClick={onClose} className="block border-t border-mist px-3 py-2.5 text-center text-sm font-medium text-trust hover:bg-cloud">View all in Overview</Link> : null}
      </div>
    </>
  );
}

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const rows = [["⌘K / Ctrl+K", "Open search"], ["?", "This help"], ["g then o", "Overview"], ["g then c", "Contacts"], ["g then p", "Pipeline"], ["g then t", "Tasks"], ["g then l", "Calendar"], ["g then a", "Activity"], ["g then s", "Settings"]];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-heading">Keyboard shortcuts</h3>
        <dl className="space-y-2 text-sm">{rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3"><dt className="text-slate">{v}</dt><dd><kbd className="rounded border border-mist bg-cloud px-1.5 py-0.5 text-xs text-body">{k}</kbd></dd></div>)}</dl>
        <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Close</button></div>
      </div>
    </div>
  );
}
