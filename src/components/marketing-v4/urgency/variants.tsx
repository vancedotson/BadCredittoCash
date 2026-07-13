"use client";

import { useState, type CSSProperties } from "react";
import { site } from "@/config/site-v3";
import { Kicker, Reveal } from "../../marketing-v3/shared/primitives";
import { useRevealChildren } from "../../marketing-v3/shared/hooks";

/* Shared content (single source of truth). */
const kicker = site.ev.kickers.urgency; // "CLOCK // TIME-SENSITIVE"
const heading = site.urgency.heading; //   "Every day you wait:"
const points = site.urgency.points; //     3 consequences (last is ⚠️ flagged)
const scarcity = site.urgency.scarcity; //  "Slots are limited, it's just me."
const n = (i: number) => String(i + 1).padStart(2, "0");
const delay = (i: number) => ((i % 4) + 1) as 1 | 2 | 3 | 4;

/* Per-line status + the three "procedure" step colors (gold, lime, green) —
   the same palette the Mechanism section walks through. */
const STATUS = ["ACCRUING", "COMPOUNDING", "EXPIRING"];
// The "procedure" step colors, read from CSS vars so the accent theme (gold on
// /v4, blue on /v5) drives them.
const stepVar = (i: number) => `var(--v3-step-${i})`;
// Short reassurance revealed on hover — calms the concern each line raises.
const REASSURE = [
  "The sooner we look, the sooner you have a plan to make them stop.",
  "The sooner it's flagged, the sooner it can be challenged. We start the record on day one.",
  "A short call tells you which options are still open, before any window closes.",
];

function Heading() {
  return (
    <>
      <Reveal>
        <Kicker>{kicker}</Kicker>
      </Reveal>
      <Reveal as="h2" className="v3-display mt-5">
        <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>{heading}</span>
      </Reveal>
    </>
  );
}

/**
 * Cost Ledger — the chosen Urgency design. A hairline row of accruing
 * consequence cells over an ambient section radar, closed by the single-advocate
 * capacity strip. Hovering a line lights it in its "procedure" step color,
 * washes that color into the background glow, and expands the cell (line 1 opens
 * rightward, line 2 both ways, line 3 leftward) to reveal a reassuring line.
 */
export function UrgencyLedger() {
  const ref = useRevealChildren<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const SEGMENTS = 14;
  const FILLED = 11;
  const glow = hover != null ? stepVar(hover) : null;

  return (
    <>
      {/* Ambient radar + hover-driven color glow, washed into the section. */}
      <div className="v4-urg-ledger-radar" aria-hidden>
        <div className="v4-urg-radar v4-urg-radar--section">
          <span className="v4-urg-ring" style={{ inset: "0%" }} />
          <span className="v4-urg-ring" style={{ inset: "14%" }} />
          <span className="v4-urg-ring" style={{ inset: "30%" }} />
          <span className="v4-urg-radar-x" />
          <span className="v4-urg-radar-y" />
          <span className="v4-urg-sweep" />
          <span className="v4-urg-radar-core" />
        </div>
        <div
          className="v4-urg-bg-glow"
          style={{ backgroundColor: glow ?? "transparent", opacity: glow ? 0.16 : 0 }}
        />
      </div>

      <div className="v3-wrap relative" ref={ref}>
        <Heading />

        <div className="v4-urg-ledger mt-10">
          {points.map((p, i) => (
            <div
              key={i}
              className="v4-urg-cell v3-reveal"
              data-delay={delay(i)}
              tabIndex={0}
              style={{ "--c": stepVar(i) } as CSSProperties}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((h) => (h === i ? null : h))}
            >
              <div className="v4-urg-cell-head v3-mono">
                <span>LINE {n(i)}</span>
                <span className="v4-urg-cell-status">{STATUS[i]}</span>
              </div>
              <div className="v4-urg-cell-body">
                <p className="v4-urg-cell-stmt">{p}</p>
                <p className="v4-urg-cell-detail">{REASSURE[i]}</p>
                <div className="v4-urg-cell-meter" aria-hidden>
                  <span style={{ width: `${45 + i * 22}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer: honest scarcity + the single-advocate capacity strip. */}
        <Reveal className="mt-8 flex flex-wrap items-center justify-between gap-x-10 gap-y-5">
          <p className="v3-mono" style={{ fontSize: 13, color: "var(--v3-mut)" }}>
            {scarcity}
          </p>
          <div className="flex items-center gap-4">
            <span
              className="v3-mono"
              style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)", whiteSpace: "nowrap" }}
            >
              INTAKE {"//"} SINGLE ADVOCATE
            </span>
            <div className="v4-urg-cap v4-urg-cap--sm" aria-hidden>
              {Array.from({ length: SEGMENTS }, (_, s) => {
                const on = s < FILLED;
                const loading = !on; // the empty spots glow in sequence, as if filling
                return (
                  <span
                    key={s}
                    data-on={on ? "1" : "0"}
                    className={loading ? "v4-urg-cap-load" : undefined}
                    style={loading ? { animationDelay: `${(s - FILLED) * 0.55}s` } : undefined}
                  />
                );
              })}
            </div>
            <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}>
              LIMITED
            </span>
          </div>
        </Reveal>
      </div>
    </>
  );
}
