"use client";

import { site } from "@/config/site-v3";
import { useRevealChildren } from "../../marketing-v3/shared/hooks";

const steps = site.howItWorks.steps;
const LABELS = ["INTAKE", "THE REVIEW", "WE MOVE"];
const num = (i: number) => String(i + 1).padStart(2, "0");
const monoAccent = {
  fontSize: 11,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-accent)",
};
const body = { fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.55 };

/* Big Numerals — vertical editorial list with giant gold numerals. */
export function HiwNumerals() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <div className="v3-wrap" ref={ref}>
      {steps.map((s, i) => (
        <div
          key={i}
          className="v3-reveal grid items-center gap-6 py-8 sm:grid-cols-[auto_1fr]"
          data-delay={(i + 1) as 1 | 2 | 3}
          style={{ borderTop: i ? "1px solid var(--v3-line-soft)" : "none" }}
        >
          <span
            className="v3-display"
            style={{ fontSize: "clamp(44px,10vw,140px)", lineHeight: 0.8, color: "var(--v3-accent)", minWidth: 120 }}
          >
            {num(i)}
          </span>
          <div>
            <div className="v3-mono" style={monoAccent}>
              STEP {num(i)} {"//"} {LABELS[i]}
            </div>
            <h3 className="v3-display mt-2" style={{ fontSize: "clamp(24px,3.4vw,40px)", color: "var(--v3-ink)" }}>
              {s.title}
            </h3>
            <p className="mt-2" style={{ ...body, maxWidth: 620 }}>
              {s.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
