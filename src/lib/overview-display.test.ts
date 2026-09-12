import { describe, expect, it } from "vitest";
import { overviewComparison, overviewContactHref, overviewRange, overviewRatio, overviewTrend } from "./overview-display";
import type { OverviewKpi, TrendPoint } from "./store";

const kpi = (overrides: Partial<OverviewKpi>): OverviewKpi => ({ key: "new", label: "New contacts", value: 2, href: "/crm/contacts", ...overrides });

describe("overview comparisons", () => {
  it("does not manufacture growth from a zero prior-period baseline", () => {
    expect(overviewComparison(kpi({ delta: 100, previousValue: 0 }))).toEqual({ text: "No prior-period baseline", positive: null });
    expect(overviewComparison(kpi({ value: 0, delta: 0, previousValue: 0 }))).toEqual({ text: "No prior-period baseline", positive: null });
  });

  it("distinguishes unchanged, unavailable, and measured changes", () => {
    expect(overviewComparison(kpi({}))).toBeNull();
    expect(overviewComparison(kpi({ delta: 0, previousValue: 2 }))).toEqual({ text: "No change", positive: null });
    expect(overviewComparison(kpi({ delta: 50, previousValue: 2 }))).toEqual({ text: "+50% vs prior period", positive: true });
    expect(overviewComparison(kpi({ delta: -25, previousValue: 4 }))).toEqual({ text: "−25% vs prior period", positive: false });
  });

  it("can mark a decrease as favorable when the measure requires it", () => {
    expect(overviewComparison(kpi({ delta: -25, deltaGood: false, previousValue: 4 }))?.positive).toBe(true);
    expect(overviewComparison(kpi({ delta: 25, deltaGood: false, previousValue: 4 }))?.positive).toBe(false);
  });
});

describe("overview contact drill-throughs", () => {
  it("retains the contact owner and selected segment while overriding saved views", () => {
    const url = new URL(overviewContactHref("/crm/contacts?segment=high_watch&view=mine", "Vance"), "https://crm.example");
    expect(Object.fromEntries(url.searchParams)).toEqual({ segment: "high_watch", view: "all", owner: "Vance" });
  });

  it("preserves encoded source and owner names without adding a date filter", () => {
    const source = "Email & SMS / webinar+replay";
    const owner = "Sales & Support + João";
    const url = new URL(overviewContactHref(`/crm/contacts?source=${encodeURIComponent(source)}`, owner), "https://crm.example");
    expect(url.searchParams.get("source")).toBe(source);
    expect(url.searchParams.get("owner")).toBe(owner);
    expect([...url.searchParams.keys()].sort()).toEqual(["owner", "source", "view"]);
  });

  it("clears owner filters for all contacts and supports the unassigned filter", () => {
    expect(overviewContactHref("/crm/contacts?owner=Vance")).toBe("/crm/contacts?view=all");
    expect(overviewContactHref("/crm/contacts", "__none__")).toBe("/crm/contacts?view=all&owner=__none__");
  });

  it("leaves other CRM destinations unchanged", () => {
    for (const href of ["/crm/pipeline", "/crm/tasks?owner=Team", "/crm/contacts/lead_123"]) {
      expect(overviewContactHref(href, "Vance")).toBe(href);
    }
  });
});

describe("overview trend grouping", () => {
  const total = (points: TrendPoint[], field: "registered" | "booked") => points.reduce((sum, point) => sum + point[field], 0);

  it("keeps short series and zero-valued days intact", () => {
    const points = [{ label: "Sep 1", registered: 0, booked: 0 }, { label: "Sep 2", registered: 2, booked: 0 }];
    expect(overviewTrend(points)).toEqual(points);
    expect(overviewTrend([])).toEqual([]);
  });

  it("conserves both totals across uneven groups and retains chronological labels", () => {
    const points = Array.from({ length: 29 }, (_, index) => ({ label: `Sep ${index + 1}`, registered: index % 3, booked: index % 5 === 0 ? 2 : 0 }));
    const snapshot = structuredClone(points);
    const grouped = overviewTrend(points);
    expect(grouped).toHaveLength(10);
    expect(grouped[0].label).toBe("Sep 1–Sep 2");
    expect(grouped.at(-1)?.label).toBe("Sep 27–Sep 29");
    expect(total(grouped, "registered")).toBe(total(points, "registered"));
    expect(total(grouped, "booked")).toBe(total(points, "booked"));
    expect(points).toEqual(snapshot);
  });

  it("retains empty periods between events instead of compressing the timeline", () => {
    const points = Array.from({ length: 30 }, (_, index) => ({ label: `Sep ${index + 1}`, registered: index === 0 ? 1 : 0, booked: index === 29 ? 1 : 0 }));
    const grouped = overviewTrend(points);
    expect(grouped.slice(1, -1)).toHaveLength(8);
    expect(grouped.slice(1, -1).every((point) => point.registered === 0 && point.booked === 0)).toBe(true);
    expect(grouped[0]).toMatchObject({ registered: 1, booked: 0 });
    expect(grouped.at(-1)).toMatchObject({ registered: 0, booked: 1 });
  });
});

describe("overview display ranges and ratios", () => {
  it("normalizes unsupported URL ranges to 30 days", () => {
    expect(overviewRange("7")).toBe(7);
    expect(overviewRange("90")).toBe(90);
    for (const value of [undefined, "", "30", "0", "-7", "365", "7oops"]) expect(overviewRange(value)).toBe(30);
  });

  it("shows unavailable ratios without a denominator while retaining measured zeros", () => {
    expect(overviewRatio(0, 0)).toBe("—");
    expect(overviewRatio(100, 0)).toBe("—");
    expect(overviewRatio(0, 4)).toBe("0%");
  });

  it("does not clamp a non-monotonic event ratio to an invented 100%", () => {
    expect(overviewRatio(150, 2)).toBe("150%");
  });
});
