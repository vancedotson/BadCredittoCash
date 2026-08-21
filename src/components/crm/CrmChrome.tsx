"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/app/login/actions";
import type { NavData } from "@/lib/store";
import { LightbulbIcon, PersonIcon, DollarIcon, CheckIcon, RefreshIcon, DocumentIcon, ShieldIcon, ImageIcon, BellIcon, SunIcon, MoonIcon } from "@/components/marketing-v2/Icons";
import { CommandPalette } from "./CommandPalette";
import { AddContactModal, AddTaskModal } from "./CrmModals";

type Pin = { id: string; name: string };

export function CrmChrome({ nav, children }: { nav: NavData; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [narrowDesktop, setNarrowDesktop] = useState(false);
  const [narrowExpanded, setNarrowExpanded] = useState(false);
  const [dark, setDark] = useState(false);
  const [palette, setPalette] = useState(false);
  const [quick, setQuick] = useState<"contact" | "task" | null>(null);
  const [notif, setNotif] = useState(false);
  const [mobileMore, setMobileMore] = useState(false);
  const [notificationItems, setNotificationItems] = useState(nav.notifications);
  const [account, setAccount] = useState(false);
  const [help, setHelp] = useState(false);
  const [recent, setRecent] = useState<Pin[]>([]);
  const [pinned, setPinned] = useState<Pin[]>([]);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setCollapsed(localStorage.getItem("crm-collapsed") === "1");
      setDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px) and (max-width: 1535px)");
    const sync = () => {
      setNarrowDesktop(media.matches);
      if (!media.matches) setNarrowExpanded(false);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try { setRecent(JSON.parse(localStorage.getItem("crm-recent") || "[]")); } catch { /* ignore */ }
      try { setPinned(JSON.parse(localStorage.getItem("crm-pinned") || "[]")); } catch { /* ignore */ }
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
  useEffect(() => {
    queueMicrotask(() => setNotificationItems(nav.notifications));
  }, [nav.notifications]);

  async function updateNotification(id: string, action: "read" | "dismiss") {
    const readAt = new Date().toISOString();
    setNotificationItems((items) => action === "dismiss"
      ? items.filter((item) => item.id !== id)
      : items.map((item) => item.id === id ? { ...item, readAt } : item));
    const response = await fetch("/api/crm/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!response.ok) router.refresh();
  }

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
  function toggleCollapse() {
    if (narrowDesktop) { setNarrowExpanded((value) => !value); return; }
    setCollapsed((value) => {
      const next = !value;
      try { localStorage.setItem("crm-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const sidebarCollapsed = narrowDesktop ? !narrowExpanded : collapsed;
  const sidebarWidth = narrowDesktop
    ? (narrowExpanded ? "-mr-44 w-60 shadow-2xl" : "w-16")
    : (collapsed ? "w-16" : "w-60");
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
    { href: "/crm/health", label: "System health", Icon: ShieldIcon },
    { href: "/crm/settings", label: "Settings", Icon: ShieldIcon },
  ];
  const MOBILE_PRIMARY = [...PRIMARY, ...SECONDARY.filter((item) => item.href === "/crm/activity")];
  const MOBILE_SECONDARY = SECONDARY.filter((item) => item.href !== "/crm/activity");
  const owner = nav.owners[0] ?? "You";
  const unreadNotifications = notificationItems.filter((item) => !item.readAt).length;

  const navItem = (it: { href: string; label: string; Icon: (p: { className?: string }) => React.ReactElement; exact?: boolean; badge?: number; tone?: "red" | "info" }) => {
    const active = isActive(it.href, it.exact);
    return (
      <Link key={it.href} href={it.href} aria-label={sidebarCollapsed ? it.label : undefined}
        className={`group relative flex min-h-11 items-center rounded-lg text-sm font-semibold transition-[color,background-color,transform] duration-150 ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-[background-color,transform] duration-150 group-hover:scale-105 ${active ? "bg-white/10 text-gold" : "group-hover:bg-white/10"}`}><it.Icon className="h-5 w-5 [stroke-width:2.25]" /></span>
        {!sidebarCollapsed ? <span className="flex-1">{it.label}</span> : null}
        {it.badge ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${it.tone === "red" ? "bg-red text-white" : "bg-gold text-ink"} ${sidebarCollapsed ? "absolute right-1 top-1" : ""}`}>{it.badge}</span> : null}
        {sidebarCollapsed ? <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+0.65rem)] top-1/2 z-[70] -translate-y-1/2 -translate-x-1.5 whitespace-nowrap rounded-lg border border-gold/50 bg-navy px-3 py-2 text-sm font-semibold text-white opacity-0 shadow-xl ring-1 ring-black/15 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"><span className="absolute right-full top-1/2 -translate-y-1/2 border-y-[6px] border-r-[7px] border-y-transparent border-r-gold/50" />{it.label}</span> : null}
      </Link>
    );
  };
  const contactHistory = <>
    {pinned.length ? (<><div className="mb-1 mt-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-gold">Pinned</div>{pinned.slice(0, 8).map((p) => <Link key={p.id} href={`/crm/contacts/${p.id}`} className="block truncate rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">★ {p.name}</Link>)}</>) : null}
    {recent.length ? (<><div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wide text-gold">Recent</div>{recent.slice(0, 8).map((p) => <Link key={p.id} href={`/crm/contacts/${p.id}`} className="block truncate rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white">{p.name}</Link>)}</>) : null}
    {pinned.length === 0 && recent.length === 0 ? <p className="px-3 py-4 text-center text-xs text-white/60">Pinned and recently viewed contacts will appear here.</p> : null}
  </>;
  const railTooltip = (label: string) => sidebarCollapsed ? <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+0.65rem)] top-1/2 z-[70] -translate-y-1/2 -translate-x-1.5 whitespace-nowrap rounded-lg border border-gold/50 bg-navy px-3 py-2 text-sm font-semibold text-white opacity-0 shadow-xl ring-1 ring-black/15 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"><span className="absolute right-full top-1/2 -translate-y-1/2 border-y-[6px] border-r-[7px] border-y-transparent border-r-gold/50" />{label}</span> : null;
  const keyboardShortcutNav = <button type="button" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts" className={`group relative flex min-h-11 w-full items-center rounded-lg text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base font-black transition-[background-color,transform] group-hover:scale-105 group-hover:bg-white/10">?</span>{!sidebarCollapsed ? <span className="flex-1 text-left">Keyboard shortcuts</span> : null}{railTooltip("Keyboard shortcuts")}</button>;

  return (
    <div className="crm-scope flex min-h-screen bg-cloud">
      {/* Desktop sidebar */}
      <aside className={`crm-sidebar sticky top-0 z-40 hidden h-screen shrink-0 flex-col text-white transition-[width,margin,box-shadow] duration-200 md:flex ${sidebarWidth}`}>
        <div className="flex h-16 items-center justify-between px-4">
          {!sidebarCollapsed ? <span className="flex items-center gap-2"><span className="font-heading text-lg font-bold text-white">Vance</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-gold">CRM</span></span> : null}
          <button type="button" onClick={toggleCollapse} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="group relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold text-xl font-black leading-none text-trust shadow-sm transition-[background-color,transform] hover:scale-105 hover:bg-gold-deep hover:text-white">
            {sidebarCollapsed ? "›" : "‹"}
            {railTooltip(sidebarCollapsed ? "Expand navigation" : "Collapse navigation")}
          </button>
        </div>

        {/* Global tools */}
        <div className="space-y-1.5 px-3 pb-2">
          <button type="button" onClick={() => setPalette(true)} aria-label="Search" className={`group relative flex min-h-10 w-full items-center rounded-lg bg-white/5 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white ${sidebarCollapsed ? "justify-center px-0" : "gap-2 px-3"}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg font-black transition-transform group-hover:scale-105">⌕</span>{!sidebarCollapsed ? <><span className="flex-1 text-left">Search</span><kbd className="rounded bg-white/10 px-1 text-[10px]">Ctrl/⌘ K</kbd></> : null}{railTooltip("Search")}
          </button>
          {!sidebarCollapsed ? (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setQuick("contact")} className="flex-1 rounded-lg bg-gold px-2 py-1.5 text-xs font-semibold text-ink hover:bg-gold-deep">+ Contact</button>
              <button type="button" onClick={() => setQuick("task")} className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/20">+ Task</button>
              <div className="relative">
                <button type="button" onClick={() => setNotif((o) => !o)} aria-label="Notifications" className="relative grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20"><BellIcon className="h-4 w-4" />{unreadNotifications ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red px-1 text-[10px] font-semibold text-white">{unreadNotifications}</span> : null}</button>
                {notif ? <NotifDropdown items={notificationItems} onClose={() => setNotif(false)} onRead={async (id, href) => { await updateNotification(id, "read"); setNotif(false); router.push(href); }} onDismiss={(id) => updateNotification(id, "dismiss")} onReadAll={() => Promise.all(notificationItems.filter((item) => !item.readAt).map((item) => updateNotification(item.id, "read"))).then(() => undefined)} /> : null}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setQuick("contact")} aria-label="Add contact" className="group relative grid min-h-10 w-full place-items-center rounded-lg bg-gold text-xl font-black text-ink shadow-sm transition-[background-color,transform] hover:scale-105 hover:bg-gold-deep hover:text-white">+{railTooltip("Add contact")}</button>
          )}
        </div>

        <nav aria-label="Primary CRM pages" className="space-y-1 px-3 pt-2">
          {PRIMARY.map(navItem)}
        </nav>
        <div className="mx-3 my-2 border-t border-white/10" />

        {/* More options replaces this bounded menu region while it is open. */}
        <div className="relative min-h-0 flex-1 px-2">
          {desktopMoreOpen && !sidebarCollapsed ? <div id="crm-desktop-more" className="crm-sidebar-options crm-sidebar-drawer-enter h-full overflow-y-auto rounded-xl border border-gold/60 bg-[#263d4e] px-1 py-2 shadow-inner">{contactHistory}</div> : <nav aria-label="Secondary CRM pages" className="space-y-1 px-1">{SECONDARY.map(navItem)}{keyboardShortcutNav}</nav>}
          {desktopMoreOpen && sidebarCollapsed ? <div id="crm-desktop-more" role="dialog" aria-label="Pinned and recent contacts" className="crm-sidebar-options crm-sidebar-popup-enter absolute bottom-0 left-full z-50 ml-3 max-h-full w-64 overflow-y-auto rounded-2xl border border-gold/70 bg-[#263d4e] p-2 shadow-2xl ring-1 ring-black/20">
            <div className="mb-1 flex items-center justify-between gap-3 px-2 py-1"><span className="text-sm font-semibold text-white">More options</span><button type="button" onClick={() => setDesktopMoreOpen(false)} aria-label="Close more options" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-lg text-white hover:bg-white/20">×</button></div>
            {contactHistory}
          </div> : null}
        </div>

        <div className="px-3 pb-2 pt-2">
          <button type="button" aria-expanded={desktopMoreOpen} aria-controls="crm-desktop-more" onClick={() => setDesktopMoreOpen((open) => !open)} className="group relative flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-gold-deep/30 bg-gold px-3 py-2 text-sm font-semibold text-ink shadow-md transition-colors hover:bg-gold-deep hover:text-white">
            <span className={`text-lg leading-none ${desktopMoreOpen ? "crm-more-arrow-down" : "crm-more-arrow"}`} aria-hidden>{desktopMoreOpen ? "↓" : "↑"}</span>
            {!sidebarCollapsed ? <span>{desktopMoreOpen ? "Close options" : "More options"}</span> : null}
            {railTooltip(desktopMoreOpen ? "Close options" : "More options")}
          </button>
        </div>

        {/* Account */}
        <div className="relative border-t border-white/10 px-3 py-3">
          <button type="button" aria-label="Open account menu" aria-expanded={account} aria-haspopup="menu" aria-controls="crm-account-menu" onClick={() => setAccount((o) => !o)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold text-white">{owner[0]}</span>
            {!sidebarCollapsed ? <span className="min-w-0 flex-1 truncate text-sm text-white/80">{owner}</span> : null}
          </button>
          {account ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAccount(false)} />
              <div id="crm-account-menu" role="menu" aria-label="Account" className="absolute bottom-14 left-3 z-20 w-52 rounded-xl border border-mist bg-card py-1 text-sm shadow-card">
                <div role="presentation" className="px-3 py-1.5 text-xs text-slate">Signed in as <span className="text-body">{owner}</span></div>
                <button type="button" role="menuitem" onClick={() => { toggleDark(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body hover:bg-cloud">{dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}{dark ? "Light mode" : "Dark mode"}</button>
                <button type="button" role="menuitem" onClick={() => { setHelp(true); setAccount(false); }} className="block w-full px-3 py-1.5 text-left text-body hover:bg-cloud">Keyboard shortcuts</button>
                <Link href="/crm/settings" role="menuitem" onClick={() => setAccount(false)} className="block px-3 py-1.5 text-body hover:bg-cloud">Settings</Link>
                <Link href="/" role="menuitem" className="block px-3 py-1.5 text-body hover:bg-cloud">View site ↗</Link>
                <div className="my-1 border-t border-mist" />
                <form action={logout}>
                  <button type="submit" role="menuitem" className="block w-full px-3 py-1.5 text-left font-medium text-red hover:bg-cloud">Sign out</button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="crm-topbar sticky top-0 z-40 text-white md:hidden">
          <nav aria-label="CRM pages" className="relative p-1 sm:p-2">
            <div className="grid w-full grid-cols-6 gap-0.5 sm:gap-1">
              {MOBILE_PRIMARY.map((it) => {
              const active = isActive(it.href, it.exact);
              return (
                <Link key={it.href} href={it.href} onClick={() => setMobileMore(false)} aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-10 min-w-0 items-center justify-center rounded-lg px-0.5 py-2 text-[11px] font-medium sm:px-1 sm:text-sm ${active ? "bg-white/12 text-white" : "text-white/70"}`}>
                  <span className="truncate">{it.label}</span>
                  {it.badge ? <span className="absolute right-0.5 top-0.5 rounded-full bg-red px-1 text-[9px] font-semibold text-white">{it.badge}</span> : null}
                </Link>
              );
              })}
              <button type="button" aria-expanded={mobileMore} aria-haspopup="menu" aria-controls="crm-mobile-more-menu" onClick={() => setMobileMore((open) => !open)} aria-label={mobileMore ? "Close CRM menu" : "Open CRM menu"} className={`grid min-h-10 min-w-0 place-items-center rounded-lg text-xl leading-none ${mobileMore || MOBILE_SECONDARY.some((it) => isActive(it.href, it.exact)) ? "bg-trust text-white" : "bg-white/10 text-white/90"}`}>☰</button>
            </div>
            {mobileMore ? (
              <>
                <button type="button" aria-label="Close more pages" className="fixed inset-0 z-10 cursor-default" onClick={() => setMobileMore(false)} />
                <div id="crm-mobile-more-menu" role="menu" aria-label="More CRM pages" className="absolute right-2 top-full z-20 w-56 overflow-hidden rounded-xl border border-mist bg-card p-1.5 text-body shadow-card">
                  <button type="button" role="menuitem" onClick={() => { setPalette(true); setMobileMore(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-body hover:bg-cloud"><span className="grid h-4 w-4 place-items-center">⌕</span>Search</button>
                  <button type="button" role="menuitem" onClick={() => { setQuick("contact"); setMobileMore(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-body hover:bg-cloud"><span className="grid h-4 w-4 place-items-center text-lg">+</span>Add contact</button>
                  <button type="button" role="menuitem" onClick={() => { setQuick("task"); setMobileMore(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-body hover:bg-cloud"><CheckIcon className="h-4 w-4" />Add task</button>
                  <button type="button" role="menuitem" onClick={() => { setNotif(true); setMobileMore(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-body hover:bg-cloud"><BellIcon className="h-4 w-4" /><span className="flex-1">Notifications</span>{unreadNotifications ? <span className="rounded-full bg-red px-1.5 py-0.5 text-[10px] font-semibold text-white">{unreadNotifications}</span> : null}</button>
                  <div className="my-1 border-t border-mist" />
                  {MOBILE_SECONDARY.map((it) => {
                    const active = isActive(it.href, it.exact);
                    return (
                      <Link key={it.href} href={it.href} role="menuitem" onClick={() => setMobileMore(false)} aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? "bg-cloud text-heading" : "text-body hover:bg-cloud"}`}>
                        <it.Icon className="h-4 w-4 shrink-0" />
                        {it.label}
                      </Link>
                    );
                  })}
                  <div className="my-1 border-t border-mist" />
                  <button type="button" role="menuitem" onClick={() => { toggleDark(); setMobileMore(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-body hover:bg-cloud">
                    {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                    <span>{dark ? "Light mode" : "Dark mode"}</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setHelp(true); setMobileMore(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-body hover:bg-cloud">
                    <span>Keyboard shortcuts</span>
                    <kbd className="rounded border border-mist bg-cloud px-1.5 py-0.5 text-xs">?</kbd>
                  </button>
                  <Link href="/" role="menuitem" onClick={() => setMobileMore(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-body hover:bg-cloud">View site ↗</Link>
                  <form action={logout}>
                    <button type="submit" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red hover:bg-cloud">Sign out</button>
                  </form>
                </div>
              </>
            ) : null}
            {notif ? <div className="absolute right-2 top-full z-30"><NotifDropdown items={notificationItems} onClose={() => setNotif(false)} onRead={async (id, href) => { await updateNotification(id, "read"); setNotif(false); router.push(href); }} onDismiss={(id) => updateNotification(id, "dismiss")} onReadAll={() => Promise.all(notificationItems.filter((item) => !item.readAt).map((item) => updateNotification(item.id, "read"))).then(() => undefined)} /></div> : null}
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

function NotifDropdown({ items, onClose, onRead, onDismiss, onReadAll }: { items: NavData["notifications"]; onClose: () => void; onRead: (id: string, href: string) => void; onDismiss: (id: string) => void; onReadAll: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-11 z-20 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-mist bg-card text-left shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-mist px-3 py-2.5">
          <span className="text-sm font-semibold text-heading">Notifications</span>
          <span className="flex items-center gap-2"><button type="button" onClick={onReadAll} className="text-xs text-trust hover:underline">Mark all read</button><span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate">{items.filter((item) => !item.readAt).length}</span></span>
        </div>
        <div className="crm-scroll max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? <p className="px-2 py-6 text-center text-sm text-slate">All clear. Nothing needs attention right now.</p> : items.map((a) => (
            <div key={a.id} className={`flex items-start gap-2 rounded-lg px-2 py-2 hover:bg-cloud ${a.readAt ? "opacity-60" : ""}`}>
              <button type="button" onClick={() => onRead(a.id, a.href)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.tone === "danger" ? "var(--color-red)" : a.tone === "warn" ? "var(--color-gold)" : a.tone === "success" ? "var(--color-green)" : "var(--color-slate)" }} />
                <span className="min-w-0"><span className="block truncate text-sm text-body">{a.title}</span><span className="block truncate text-xs text-slate">{a.subtitle}</span></span>
              </button>
              <button type="button" onClick={() => onDismiss(a.id)} aria-label={`Dismiss ${a.title}`} className="shrink-0 px-1 text-sm text-slate hover:text-red">×</button>
            </div>
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
      <div role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-title" className="w-full max-w-sm rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 id="keyboard-shortcuts-title" className="mb-4 text-lg font-semibold text-heading">Keyboard shortcuts</h3>
        <dl className="space-y-2 text-sm">{rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3"><dt className="text-slate">{v}</dt><dd><kbd className="rounded border border-mist bg-cloud px-1.5 py-0.5 text-xs text-body">{k}</kbd></dd></div>)}</dl>
        <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Close</button></div>
      </div>
    </div>
  );
}
