"use client";

import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site-v3";
import { PlayIcon, CheckIcon } from "@/components/marketing-v2/Icons";

/**
 * v4 hero — based on Case File, with round-1 changes:
 *  1. The OKC night skyline is far more present (higher opacity, less tint,
 *     a left-weighted scrim so the city clearly shows on the right).
 *  2. The file-number bar is dropped from the photo (cleaner, "black side"
 *     preference); metadata now reads inline by the kicker (EST. 2004 · OKC).
 *  3. Vance sits in a contained panel and is never cropped on the right.
 */
export function HeroV4() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "100svh", paddingTop: 96 }}
    >
      {/* OKC night skyline — now clearly visible */}
      <Image
        src="/oklahoma-night.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
        style={{ opacity: 0.62, filter: "grayscale(0.12) contrast(1.08) brightness(1.02)" }}
      />
      {/* left-weighted scrim: dark behind the headline, clear over the city */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(6,6,7,0.94) 0%, rgba(6,6,7,0.78) 38%, rgba(6,6,7,0.32) 72%, rgba(6,6,7,0.15) 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 55%, rgba(6,6,7,0.55) 82%, var(--v3-bg) 100%)",
        }}
      />

      <div
        className="v3-wrap relative grid items-stretch gap-12 lg:grid-cols-[1.1fr_0.9fr]"
        style={{ minHeight: "calc(100svh - 96px)", animation: "fadeup 0.8s ease-out both" }}
      >
        {/* left column */}
        <div className="flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-4">
            <span className="v3-kicker">{site.ev.kickers.hero}</span>
            <span
              className="v3-mono"
              style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--v3-faint)" }}
            >
              {site.ev.established}
            </span>
          </div>

          <h1
            className="v3-display mt-6"
            style={{ fontSize: "clamp(36px,8vw,104px)", lineHeight: 0.9 }}
          >
            The calls stop.{" "}
            <span className="v3-accent-text">Find out</span> if they owe you.
          </h1>
          <p
            className="mt-7"
            style={{ fontSize: "clamp(16px,1.7vw,19px)", color: "var(--v3-mut)", maxWidth: 560, lineHeight: 1.6 }}
          >
            {site.hero.subhead}
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={site.cta.primary.href} className="v3-btn v3-btn-primary v3-clip" style={{ paddingLeft: 12 }}>
              <span className="v3-btn-badge">
                <PlayIcon className="h-4 w-4" />
              </span>
              {site.cta.primary.label}
            </Link>
            <Link href={site.cta.secondary.href} className="v3-btn v3-btn-ghost">
              {site.cta.secondary.label} →
            </Link>
          </div>

          {/* evidence checks */}
          <ul className="mt-9 grid gap-2.5">
            {site.hero.bullets.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span style={{ color: "var(--v3-accent)" }}>
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span style={{ fontSize: 15, color: "var(--v3-ink)" }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* right column — Blacksite Ledger-style full-height photo strip that
            bleeds into the page; kept wide + object-position tuned so Vance is
            never cropped on the right. */}
        <div
          className="relative hidden self-stretch lg:block"
          style={{ borderLeft: "1px solid var(--v3-line)" }}
        >
          <Image
            src="/vance.png"
            alt="Vance Dotson, consumer advocate"
            fill
            priority
            sizes="(min-width: 1024px) 44vw, 90vw"
            className="object-cover"
            style={{
              objectPosition: "center top",
              filter: "grayscale(0.12) contrast(1.08)",
              // Feather the right edge so the photo dissolves into the city
              // instead of cutting against it (also softens the bottom).
              maskImage:
                "linear-gradient(90deg, #000 62%, transparent 99%), linear-gradient(180deg, #000 82%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(90deg, #000 62%, transparent 99%), linear-gradient(180deg, #000 82%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 44%, rgba(6,6,7,0.6) 78%, var(--v3-bg) 100%), linear-gradient(90deg, rgba(6,6,7,0.55), transparent 26%)",
            }}
          />
          <span
            className="v3-mono absolute bottom-4 left-4"
            style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--v3-mut)" }}
          >
            {site.hero.photoCaption}
          </span>
        </div>
      </div>

      {/* Right-side black gradient: transparent at the left edge of the author
          container (~53% across), ramping to solid black at the right edge, so
          Vance emerges from black and the right edge stays clean. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            "linear-gradient(90deg, transparent 53%, rgba(0,0,0,0.4) 74%, #000 100%)",
        }}
      />
    </section>
  );
}
