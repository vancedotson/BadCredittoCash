"use client";

import Link from "next/link";
import { site } from "@/config/site-v3";

/**
 * v4 header — the Case File nav (kept, per request) PLUS the animated gold
 * "beam" that sweeps left→right along the bottom edge, matching the live /
 * design. Beam respects prefers-reduced-motion.
 */
export function HeaderV4() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.18) 70%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="v3-wrap flex items-center justify-between py-4">
        <Link href="#top" className="flex flex-col leading-none">
          <span
            className="v3-display"
            style={{ fontSize: 22, letterSpacing: "0.04em" }}
          >
            VANCE DOTSON
          </span>
          <span
            className="v3-mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.22em",
              color: "var(--v3-accent)",
              marginTop: 3,
            }}
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
              style={{
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--v3-mut)",
              }}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <Link
          href={site.cta.primary.href}
          className="v3-btn v3-btn-ghost hidden sm:inline-flex"
          style={{ minHeight: 42, fontSize: 13, padding: "0 18px" }}
        >
          {site.cta.secondary.label}
        </Link>
      </div>

      {/* Bottom-border beam: a static gold hairline + a gold highlight that
          sweeps left→right, tapering at both ends (blurred glow + sharp line).
          Uses the global `beam` keyframe. Hidden for reduced motion. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--v3-accent) 40%, transparent), transparent)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-px w-1/4 motion-reduce:hidden"
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
    </header>
  );
}
