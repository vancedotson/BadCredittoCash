"use client";

import { TIMES, slotLabelOf, slotStart, type Day } from "./slots";

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
  unavailableStarts = new Set<string>(),
  busyIntervals = [],
}: {
  days: Day[];
  dayKey: string;
  onDay: (k: string) => void;
  time: string;
  onTime: (t: string) => void;
  /** "row" = horizontal scroll strip (default); "calendar" = week-grid calendar. */
  dayLayout?: "row" | "calendar";
  labelSize?: number;
  unavailableStarts?: Set<string>;
  busyIntervals?: Array<{ start: string; end: string }>;
}) {
  const slotLabel = slotLabelOf(days, dayKey, time);
  const lbl = { ...labelStyle, fontSize: labelSize };

  // For the calendar layout: lay days out in weekday columns, stacked by week.
  const weeks = days.length ? Math.max(...days.map((d) => d.week)) + 1 : 0;
  const cells: (Day | null)[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let col = 0; col < 7; col++) {
      cells.push(days.find((d) => d.week === w && d.dow === col) ?? null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="v3-mono mb-2 block" style={lbl}>Choose a day</span>
        {days.length === 0 ? (
          <p className="v3-mono" style={{ fontSize: 13, color: "var(--v3-faint)" }}>Loading available days…</p>
        ) : dayLayout === "calendar" ? (
          <div>
            <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center">
              {["S", "M", "T", "W", "T", "F", "S"].map((L, i) => (
                <span key={i} className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.04em", color: "var(--v3-faint)" }}>{L}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((c, i) =>
                c === null ? (
                  <div key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onDay(c.key)}
                    className="rounded-sm px-1 py-2 text-center transition-colors"
                    style={{
                      border: `1px solid ${c.key === dayKey ? "var(--v3-accent)" : "var(--v3-line)"}`,
                      background: c.key === dayKey ? "color-mix(in srgb, var(--v3-accent) 14%, transparent)" : "transparent",
                    }}
                  >
                    <span className="v3-display block" style={{ fontSize: 18, lineHeight: 1.1, color: "var(--v3-ink)" }}>{c.dayNum}</span>
                    <span className="v3-mono block" style={{ fontSize: 8.5, color: "var(--v3-faint)" }}>{c.month.toUpperCase()}</span>
                  </button>
                ),
              )}
            </div>
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
            const starts = slotStart(dayKey, t);
            const ends = starts ? new Date(starts.getTime() + 30 * 60 * 1000) : null;
            const unavailable = !!starts && (
              unavailableStarts.has(starts.toISOString())
              || busyIntervals.some((interval) =>
                new Date(interval.start).getTime() < (ends?.getTime() ?? 0)
                && new Date(interval.end).getTime() > starts.getTime()
              )
            );
            return (
              <button
                key={t}
                type="button"
                onClick={() => !unavailable && onTime(t)}
                disabled={unavailable}
                className="v3-mono rounded-sm px-3 py-3 transition-colors"
                style={{
                  fontSize: 15,
                  border: `1px solid ${sel ? "var(--v3-accent)" : "var(--v3-line)"}`,
                  background: sel ? "color-mix(in srgb, var(--v3-accent) 14%, transparent)" : "rgba(0,0,0,0.25)",
                  color: unavailable ? "var(--v3-faint)" : sel ? "var(--v3-ink)" : "var(--v3-mut)",
                  opacity: unavailable ? 0.45 : 1,
                  cursor: unavailable ? "not-allowed" : "pointer",
                }}
              >
                {t}{unavailable ? " — Booked" : ""}
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
