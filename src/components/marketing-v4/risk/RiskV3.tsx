"use client";

import Link from "next/link";
import { site } from "@/config/site-v3";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useRevealChildren } from "../../marketing-v3/shared/hooks";
import { PlayIcon } from "@/components/marketing-v2/Icons";

/**
 * V3-only "Terms // No Risk" — the chosen "Ledger" layout: the headline + CTAs
 * beside an ink "terms of engagement" document, on a black section. Content is
 * compliance-safe (no guarantees). Tokens/backgrounds come from `#risk` in v3.css.
 */
const kicker = site.ev.kickers.risk;
const points = site.riskReversal.points;
const n = (i: number) => String(i + 1).padStart(2, "0");

// A short calming line per clause, revealed on hover/focus.
const DETAIL = [
  "No card, no catch. You get real answers whether or not we ever work together.",
  "Whatever's on your report, I've seen worse. You won't be lectured, just helped.",
  "Nothing gets signed on the call. You decide what happens next, on your own timeline.",
  "Even if we do nothing else, you walk away knowing exactly what's on your report and what your options are.",
];

export function RiskV3() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section relative" id="risk">
      <SectionScan />
      <div className="v3-wrap grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]" ref={ref}>
        <div>
          <Reveal>
            <Kicker>{kicker}</Kicker>
            <h2
              className="v3-display mt-5"
              style={{ fontSize: "clamp(36px,5.4vw,66px)", maxWidth: 560 }}
            >
              You&apos;ve got{" "}
              <span style={{ color: "var(--v3-accent)" }}>nothing to lose</span> by
              looking.
            </h2>
          </Reveal>
          <Reveal className="mt-9 flex flex-wrap items-center gap-4" delay={1}>
            <Link
              href={site.cta.primary.href}
              className="v3-btn v3-btn-primary v3-clip"
              style={{ paddingLeft: 12 }}
            >
              <span className="v3-btn-badge">
                <PlayIcon className="h-4 w-4" />
              </span>
              {site.cta.primary.label}
            </Link>
            <Link href={site.cta.secondary.href} className="v3-btn v3-btn-ghost">
              {site.cta.secondary.label} →
            </Link>
          </Reveal>
        </div>

        <Reveal className="v4-risk-box v3-clip v3-corner relative" delay={1}>
          <div
            className="v3-mono flex items-center justify-between pb-5"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)", borderBottom: "1px solid var(--v3-line)" }}
          >
            <span>{site.ev.fileNo} · TERMS OF ENGAGEMENT</span>
            <span style={{ color: "var(--v3-accent)" }}>NO RISK</span>
          </div>
          {points.map((p, i) => (
            <div
              key={i}
              className="v4-risk-clause"
              tabIndex={0}
              style={{ borderTop: i ? "1px solid var(--v3-line-soft)" : "none" }}
            >
              <div className="flex items-baseline gap-5 px-2 py-4">
                <span
                  className="v4-risk-clause-num v3-mono shrink-0"
                  style={{ fontSize: 13, color: "var(--v3-accent)", letterSpacing: "0.08em" }}
                >
                  § {n(i)}
                </span>
                <div className="min-w-0">
                  <span style={{ fontSize: 17, color: "var(--v3-ink)", lineHeight: 1.4 }}>{p}</span>
                  <p
                    className="v4-risk-clause-detail"
                    style={{ fontSize: 14, color: "var(--v3-mut)", lineHeight: 1.55, maxWidth: 440 }}
                  >
                    {DETAIL[i]}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
