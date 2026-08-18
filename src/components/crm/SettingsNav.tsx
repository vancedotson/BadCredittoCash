"use client";

import { useEffect, useRef, useState } from "react";

type SettingsGroup = { label: string; items: Array<{ id: string; label: string }> };

const GROUP_TONES = [
  { panel: "border-trust/25 bg-sky/55", dot: "bg-trust" },
  { panel: "border-gold/40 bg-gold/10", dot: "bg-gold-deep" },
  { panel: "border-green/25 bg-green/10", dot: "bg-green" },
  { panel: "border-red/20 bg-red/5", dot: "bg-red" },
];

export function SettingsNav({ groups }: { groups: SettingsGroup[] }) {
  const items = groups.flatMap((group) => group.items);
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const fadeTimer = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const activeLocked = useRef(false);

  useEffect(() => {
    const sections = items.map((item) => document.getElementById(item.id)).filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver((entries) => {
      if (activeLocked.current) return;
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActive(visible.target.id);
    }, { rootMargin: "-18% 0px -68% 0px", threshold: [0, 0.1, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => () => {
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
  }, []);

  function go(id: string) {
    setActive(id); setOpen(false);
    const section = document.getElementById(id);
    const page = section?.closest(".settings-page");
    if (!section || !page) return;
    if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    page.querySelectorAll(".settings-section-pulse").forEach((element) => element.classList.remove("settings-section-pulse"));
    page.querySelectorAll(".settings-section-selected").forEach((element) => element.classList.remove("settings-section-selected"));
    // Force style invalidation so clicking the same destination restarts its animation.
    void section.offsetWidth;
    activeLocked.current = true;
    page.classList.add("settings-focus");
    section.classList.add("settings-section-selected");
    section.classList.add("settings-section-pulse");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    fadeTimer.current = window.setTimeout(() => page.classList.remove("settings-focus"), 1500);
    pulseTimer.current = window.setTimeout(() => { section.classList.remove("settings-section-pulse"); activeLocked.current = false; }, 3000);
  }

  const activeLabel = items.find((item) => item.id === active)?.label ?? "Choose a section";
  return (
    <nav aria-label="Settings sections" className="sticky top-[6.75rem] z-20 -mx-1 rounded-xl border border-mist bg-card/95 p-2 shadow-sm backdrop-blur sm:top-[6.75rem] md:top-2">
      <div className="sm:hidden">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-h-11 w-full items-center justify-between rounded-lg bg-cloud px-3 text-left text-sm font-semibold text-heading">
          <span><span className="mr-2 text-xs font-medium uppercase tracking-wide text-slate">Section</span>{activeLabel}</span><span aria-hidden>{open ? "⌃" : "⌄"}</span>
        </button>
        {open ? <div className="mt-2 grid gap-1 rounded-lg border border-mist bg-card p-2 shadow-lg">{groups.map((group) => <div key={group.label} className="py-1"><div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate">{group.label}</div>{group.items.map((item) => <button key={item.id} type="button" onClick={() => go(item.id)} className={`block min-h-10 w-full rounded-md px-2 text-left text-sm ${active === item.id ? "bg-sky font-semibold text-trust" : "text-body hover:bg-cloud"}`}>{item.label}</button>)}</div>)}</div> : null}
      </div>
      <div className="hidden grid-cols-1 gap-2 sm:grid xl:grid-cols-4">
        {groups.map((group, index) => (
          <div key={group.label} className={`min-w-0 rounded-lg border p-2.5 ${GROUP_TONES[index % GROUP_TONES.length].panel}`}>
            <div className="mb-1.5 flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-heading"><span className={`h-2 w-2 rounded-full ${GROUP_TONES[index % GROUP_TONES.length].dot}`} />{group.label}</div>
            <div className="flex flex-wrap gap-1">{group.items.map((item) => <button key={item.id} type="button" onClick={() => go(item.id)} className={`min-h-9 rounded-md px-2 py-1 text-xs font-medium transition-colors ${active === item.id ? "bg-card text-trust shadow-sm" : "text-body hover:bg-card hover:text-trust"}`}>{item.label}</button>)}</div>
          </div>
        ))}
      </div>
    </nav>
  );
}
