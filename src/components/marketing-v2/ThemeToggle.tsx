"use client";

import { SunIcon, MoonIcon } from "./Icons";

/**
 * Light/dark theme toggle. Flips data-theme on <html> and persists it. The icon
 * shown is CSS-driven (the `dark:` variant), so there's no state / hydration
 * flash; the initial theme is applied pre-paint by the script in layout.tsx.
 */
export function ThemeToggle() {
  function toggle() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-gold hover:text-gold"
    >
      <MoonIcon className="h-[18px] w-[18px] dark:hidden" />
      <SunIcon className="hidden h-[18px] w-[18px] dark:block" />
    </button>
  );
}
