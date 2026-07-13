"use client";

import { CheckIcon } from "@/components/marketing-v2/Icons";

/**
 * Funnel progress header — where the visitor is in the WEBINAR JOURNEY (which
 * page), not the quiz. Register -> Confirm (this page) -> Watch the training.
 * `current` is 1-based; the active step pulses (.v4-step-active in v3.css).
 * Reusable across funnel steps: the room page can render it with current={3}.
 */
const FUNNEL_STEPS = ["Register", "Confirm", "Watch"];

export function FunnelProgress({ current, note }: { current: number; note?: string }) {
  const total = FUNNEL_STEPS.length;
  return (
    <div style={{ borderBottom: "1px solid var(--v3-line)", paddingBottom: "clamp(20px,3vw,28px)" }}>
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <span className="v3-mono" style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--v3-faint)" }}>
          STEP {current} OF {total}
        </span>
        {note ? (
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--v3-accent)" }}>{note}</span>
        ) : null}
      </div>

      {/* nodes + connectors */}
      <div className="mt-4 flex items-center" style={{ maxWidth: 760 }}>
        {FUNNEL_STEPS.map((label, i) => {
          const num = i + 1;
          const done = num < current;
          const active = num === current;
          const on = done || active;
          const size = active ? 38 : 30;
          return (
            <div
              key={label}
              className="flex items-center"
              style={{ flex: i < total - 1 ? 1 : "0 0 auto" }}
            >
              <span
                className={`v3-mono grid place-items-center${active ? " v4-step-active" : ""}`}
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  flexShrink: 0,
                  fontSize: active ? 15 : 12,
                  fontWeight: 700,
                  border: active
                    ? "2px solid var(--v3-accent)"
                    : `1px solid ${on ? "var(--v3-accent)" : "var(--v3-line)"}`,
                  background: done
                    ? "var(--v3-accent)"
                    : active
                      ? "color-mix(in srgb, var(--v3-accent) 16%, transparent)"
                      : "transparent",
                  color: done ? "var(--v3-bg)" : on ? "var(--v3-accent)" : "var(--v3-faint)",
                  transition: "width 0.2s ease, height 0.2s ease",
                }}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : num}
              </span>
              {i < total - 1 ? (
                <span
                  aria-hidden
                  style={{
                    flex: 1,
                    height: 2,
                    margin: "0 12px",
                    background: num < current ? "var(--v3-accent)" : "var(--v3-line)",
                    transition: "background 0.2s ease",
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* step labels, aligned under their nodes */}
      <div className="mt-2.5 flex" style={{ maxWidth: 760 }}>
        {FUNNEL_STEPS.map((label, i) => {
          const num = i + 1;
          const active = num === current;
          const done = num < current;
          return (
            <span
              key={label}
              className="v3-mono"
              style={{
                flex: 1,
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontWeight: active ? 700 : 400,
                color: active ? "var(--v3-accent)" : done ? "var(--v3-mut)" : "var(--v3-faint)",
                textAlign: i === 0 ? "left" : i === total - 1 ? "right" : "center",
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
