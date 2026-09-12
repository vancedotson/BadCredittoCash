export type LiveCalendarDay = { date: string; day: number; inMonth: boolean };

function monthStart(month: string): Date {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)) throw new RangeError("Enter a calendar month as YYYY-MM.");
  return new Date(`${month}-01T12:00:00.000Z`);
}

/** Place an instant on the operator's chosen calendar, including across DST. */
export function calendarDate(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year").padStart(4, "0")}-${value("month")}-${value("day")}`;
}

/** Monday-first grid, retaining the preceding and following month's dates. */
export function calendarMonthDays(month: string): LiveCalendarDay[] {
  const first = monthStart(month);
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const length = Math.max(35, Math.ceil((offset + last.getUTCDate()) / 7) * 7);
  return Array.from({ length }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(1 - offset + index);
    const iso = date.toISOString().slice(0, 10);
    return { date: iso, day: date.getUTCDate(), inMonth: iso.slice(0, 7) === month };
  });
}

export function shiftCalendarMonth(month: string, delta: number): string {
  if (!Number.isInteger(delta)) throw new RangeError("Calendar month changes must be whole numbers.");
  const date = monthStart(month);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

export function formatCalendarMonth(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthStart(month));
}
