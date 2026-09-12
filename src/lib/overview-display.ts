import type { OverviewKpi, TrendPoint } from "./store";

export function overviewRange(value?: string): number {
  return value === "7" ? 7 : value === "90" ? 90 : 30;
}

/** Contact drill-throughs retain contact ownership, without inventing a date filter. */
export function overviewContactHref(href: string, owner?: string): string {
  const url = new URL(href, "https://crm.invalid");
  if (url.pathname !== "/crm/contacts") return href;
  url.searchParams.set("view", "all");
  if (owner) url.searchParams.set("owner", owner);
  else url.searchParams.delete("owner");
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function overviewComparison(kpi: OverviewKpi): { text: string; positive: boolean | null } | null {
  if (kpi.previousValue === 0) return { text: "No prior-period baseline", positive: null };
  if (kpi.delta === undefined) return null;
  if (kpi.delta === 0) return { text: "No change", positive: null };
  return { text: `${kpi.delta > 0 ? "+" : "−"}${Math.abs(kpi.delta)}% vs prior period`, positive: kpi.deltaGood === false ? kpi.delta < 0 : kpi.delta > 0 };
}

/** Group daily values without smoothing, dropping zero days, or changing totals. */
export function overviewTrend(points: TrendPoint[], limit = 10): TrendPoint[] {
  if (points.length <= limit) return points;
  return Array.from({ length: limit }, (_, index) => {
    const group = points.slice(Math.floor(index * points.length / limit), Math.floor((index + 1) * points.length / limit));
    return {
      label: group.length > 1 ? `${group[0].label}–${group.at(-1)!.label}` : group[0].label,
      registered: group.reduce((total, point) => total + point.registered, 0),
      booked: group.reduce((total, point) => total + point.booked, 0),
    };
  });
}

export function overviewRatio(value: number, denominator: number): string {
  return denominator > 0 ? `${value}%` : "—";
}
