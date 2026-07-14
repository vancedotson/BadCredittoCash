"use client";

import { TIMES, slotLabelOf, type Day } from "./slots";

const labelStyle = {
  fontSize: 10,
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: "var(--v3-faint)",
};

/**
 * Day-strip + time-grid availability picker in the case-file style. Presentational:
 * the parent owns the state and passes setters. Reused by /book and the
 * /webinar/call booking wizard. Accent tracks the active V1/V2/V3 variant.
 */
export function SlotPicker({
  days,
  dayKey,
  onDay,
  time,
  onTime,
  dayLayout = "row",
  labelSize = 10,
}: {
  days: Day[];
  dayKey: string;
  onDay: (k: string) => void;
  time: string;
  onTime: (t: string) => void;
  /** "row" = horizontal scroll strip (default); "stack" = vertical list. */
  dayLayout?: "row" | "stack";
  labelSize?: number;
}) {
  const slotLabel = slotLabelOf(days, dayKey, time);
  const lbl = { ...labelStyle, fontSize: labelSize };
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="v3-mono mb-2 block" style={lbl}>Choose a day</span>
        {days.length === 0 ? (
          <p className="v3-mono" style={{ fontSize: 13, color: "var(--v3-faint)" }}>Loading available days…</p>
        ) : dayLayout === "stack" ? (
          <div className="flex flex-col gap-2">
            {days.map((d) => {
              const sel = d.key === dayKey;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onDay(d.key)}
                  className="v3-mono w-full rounded-sm px-4 py-3 text-left transition-colors"
                  style={{
                    fontSize: 14.5,
                    border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                    background: sel ? "color-mix(in srgb, var(--v3-accent) 14%, transparent)" : "rgba(0,0,0,0.25)",
                    color: sel ? "var(--v3-ink)" : "var(--v3-mut)",
                  }}
                >
                  {d.full}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const sel = d.key === dayKey;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onDay(d.key)}
                  className="shrink-0 rounded-sm px-3 py-2 text-center transition-colors"
                  style={{
                    minWidth: 62,
                    border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                    background: sel ? "color-mix(in srgb, var(--v3-accent) 14%, transparent)" : "transparent",
                  }}
                >
                  <span className="v3-mono block" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--v3-faint)" }}>{d.weekday.toUpperCase()}</span>
                  <span className="v3-display block" style={{ fontSize: 20, lineHeight: 1.1, color: "var(--v3-ink)" }}>{d.dayNum}</span>
                  <span className="v3-mono block" style={{ fontSize: 9, color: "var(--v3-faint)" }}>{d.month.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <span className="v3-mono mb-2 block" style={lbl}>Available times</span>
        <div className="grid grid-cols-2 gap-2">
          {TIMES.map((t) => {
            const sel = t === time;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTime(t)}
                className="v3-mono rounded-sm px-3 py-3 transition-colors"
                style={{
                  fontSize: 15,
                  border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                  background: sel ? "color-mix(in srgb, var(--v3-accent) 14%, transparent)" : "rgba(0,0,0,0.25)",
                  color: sel ? "var(--v3-ink)" : "var(--v3-mut)",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <p className="v3-mono mt-3" style={{ fontSize: 12.5, color: slotLabel ? "var(--v3-accent)" : "var(--v3-faint)" }}>
          {slotLabel ? `Selected: ${slotLabel}` : "Pick a day and a time above."}
        </p>
      </div>
    </div>
  );
}
