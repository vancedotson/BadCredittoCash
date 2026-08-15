"use client";

import { useState } from "react";
import Link from "next/link";
import { site } from "@/config/site-v3";

/**
 * v4 header — the Case File nav PLUS the animated gold "beam" along the bottom
 * edge. On phones (< md) the nav links / CTA / version toggle collapse into a
 * hamburger dropdown panel. Beam respects prefers-reduced-motion.
 */
export function HeaderV4() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.18) 70%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="v3-wrap flex items-center justify-between py-4">
        <Link href="#top" className="flex flex-col leading-none" onClick={() => setOpen(false)}>
          <span className="v3-display" style={{ fontSize: 22, letterSpacing: "0.04em" }}>
            VANCE DOTSON
          </span>
          <span
            className="v3-mono"
            style={{ fontSize: 9.5, letterSpacing: "0.22em", color: "var(--v3-accent)", marginTop: 3 }}
          >
            {site.ev.fileNo}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {site.nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="v3-mono transition-colors hover:text-[var(--v3-accent)]"
              style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--v3-mut)" }}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href={site.cta.primary.href}
            className="v3-btn v3-btn-ghost v4-bar-cta"
            style={{ minHeight: 42, fontSize: 13, padding: "0 18px" }}
          >
            {site.cta.secondary.label}
          </Link>
          {/* hamburger — mobile only (display handled in v3.css; Tailwind's
              `hidden` can't override .v4-navburger's own display) */}
          <button
            type="button"
            className="v4-navburger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <>
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* mobile dropdown panel */}
      {open && (
        <div className="v4-navmenu md:hidden">
          <nav className="v4-navmenu-links">
            {site.nav.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)}>
                {n.label}
              </a>
            ))}
          </nav>
          <Link
            href={site.cta.primary.href}
            className="v3-btn v3-btn-primary v3-clip"
            style={{ width: "100%" }}
            onClick={() => setOpen(false)}
          >
            {site.cta.secondary.label}
          </Link>
        </div>
      )}

      {/* Bottom-border beam, wrapped so it stays clipped now that the header
          itself can overflow (for the dropdown). */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span
          className="absolute inset-x-0 bottom-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--v3-accent) 40%, transparent), transparent)",
          }}
        />
        <span
          className="absolute bottom-0 left-0 h-px w-1/4 motion-reduce:hidden"
          style={{ animation: "beam 5s linear infinite" }}
        >
          <span
            className="absolute inset-x-0 bottom-0 h-2 blur-[4px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, color-mix(in srgb, var(--v3-accent) 70%, transparent), transparent)",
            }}
          />
          <span
            className="absolute inset-x-0 bottom-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, var(--v3-accent), transparent)",
            }}
          />
        </span>
      </span>
    </header>
  );
}
