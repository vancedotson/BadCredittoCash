/**
 * Shared availability slots for the strategy-call schedulers (/book and the
 * /webinar/call wizard). Generated weekday slots — no live calendar yet; a real
 * scheduler (Calendly/Cal.com) slots in behind this later. buildDays() uses the
 * current date, so it must be called from an effect (not render).
 */
export type Day = { key: string; weekday: string; dayNum: string; month: string; full: string };

export const TIMES = ["9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM"];

/** Next 10 weekdays starting tomorrow. */
export function buildDays(): Day[] {
  const out: Day[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  while (out.length < 10) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      out.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
        dayNum: String(d.getDate()),
        month: d.toLocaleDateString("en-US", { month: "short" }),
        full: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Human label for the chosen slot, or "" if incomplete. */
export function slotLabelOf(days: Day[], dayKey: string, time: string): string {
  const d = days.find((x) => x.key === dayKey);
  return d && time ? `${d.full} at ${time}` : "";
}
