import { describe, expect, it } from "vitest";
import { contactExportHref, contactPageHref, readContactViews, resolveContactsQuery } from "./contacts-display";

const defaults = { view: "all", pageSize: 25 };
const sessionId = "123e4567-e89b-42d3-a456-426614174000";
const paramsOf = (href: string) => new URL(href, "https://crm.example").searchParams;

describe("contact query defaults and exports", () => {
  it("uses the same saved view and page size in data, controls, paging, and export", () => {
    const state = resolveContactsQuery({ owner: "Vance" }, { view: "hot", pageSize: 50 });
    expect(state.filter).toMatchObject({ view: "hot", owner: "Vance", page: 1, pageSize: 50 });
    expect(new URLSearchParams(state.query).get("view")).toBe("hot");
    const next = paramsOf(contactPageHref(state.query, 2));
    expect(next.get("view")).toBe("hot");
    expect(next.get("owner")).toBe("Vance");
    expect(next.get("pageSize")).toBe("50");
    expect(next.get("page")).toBe("2");
    const exported = paramsOf(contactExportHref(next.toString()));
    expect(exported.get("view")).toBe("hot");
    expect(exported.get("owner")).toBe("Vance");
    expect(exported.has("page")).toBe(false);
    expect(exported.has("pageSize")).toBe(false);
  });

  it("lets explicit All override preferences without sending the unsupported all view to SQL", () => {
    const state = resolveContactsQuery({ view: "all" }, { view: "clients", pageSize: 50 });
    expect(new URLSearchParams(state.query).get("view")).toBe("all");
    expect(state.filter.view).toBeUndefined();
    expect(paramsOf(contactExportHref(state.query)).has("view")).toBe(false);
    const next = paramsOf(contactPageHref(state.query, 2));
    expect(next.get("view")).toBe("all");
    expect(resolveContactsQuery(Object.fromEntries(next), { view: "clients", pageSize: 50 }).filter.view).toBeUndefined();
  });

  it("preserves encoded contact filters through navigation and export", () => {
    const input = { q: "João & Sales", source: "Email + SMS / replay", owner: "Sales & Support", tag: "priority+2026", stage: "engaged", segment: "high_watch" };
    const state = resolveContactsQuery(input, defaults);
    for (const href of [contactPageHref(state.query, 3), contactExportHref(state.query)]) {
      const params = paramsOf(href);
      for (const [key, value] of Object.entries(input)) expect(params.get(key)).toBe(value);
    }
  });

  it("keeps session membership in the live funnel and clears incompatible evergreen sessions", () => {
    const live = resolveContactsQuery({ sessionId, owner: "Vance" }, defaults);
    expect(live.filter).toMatchObject({ sessionId, funnel: "live", owner: "Vance" });
    expect(paramsOf(contactExportHref(live.query)).get("sessionId")).toBe(sessionId);
    const evergreen = resolveContactsQuery({ sessionId, funnel: "evergreen" }, defaults);
    expect(evergreen.filter.funnel).toBe("evergreen");
    expect(evergreen.filter.sessionId).toBeUndefined();
    expect(new URLSearchParams(evergreen.query).has("sessionId")).toBe(false);
  });

  it("does not pass malformed session identifiers into the UUID database filter", () => {
    const state = resolveContactsQuery({ sessionId: "not-a-session-uuid", owner: "Vance" }, defaults);
    expect(state.filter.sessionId).toBeUndefined();
    expect(state.filter.owner).toBe("Vance");
    expect(new URLSearchParams(state.query).has("sessionId")).toBe(false);
  });

  it("normalizes malformed URL numbers and repeated enum values before the database query", () => {
    for (const page of ["-10", "NaN", "Infinity", "0"]) {
      const result = resolveContactsQuery({ page, pageSize: page, stage: ["won", "lost"], segment: "unknown", sort: "unknown", dir: "sideways", view: "unknown" }, defaults);
      expect(result.filter).toMatchObject({ page: 1, pageSize: 25, sort: "recent", dir: "desc" });
      expect(result.filter.stage).toBeUndefined();
      expect(result.filter.segment).toBeUndefined();
      expect(result.filter.view).toBeUndefined();
    }
    const capped = resolveContactsQuery({ page: "999999999", pageSize: "999999999" }, defaults);
    expect(capped.filter.page).toBeLessThanOrEqual(1_000_000);
    expect(capped.filter.pageSize).toBeLessThanOrEqual(200);
  });

  it("treats the all-owner sentinel as no owner filter and retains Unassigned", () => {
    expect(resolveContactsQuery({ owner: "__all__" }, defaults).filter.owner).toBeUndefined();
    expect(resolveContactsQuery({ owner: "__none__" }, defaults).filter.owner).toBe("__none__");
  });

  it("drops unknown parameters and first-page state without losing a chosen sort", () => {
    const state = resolveContactsQuery({ sort: "name", dir: "asc", page: "4", redirect: "https://outside.example", action: "delete" }, defaults);
    const first = paramsOf(contactPageHref(state.query, 1));
    expect(first.get("sort")).toBe("name");
    expect(first.get("dir")).toBe("asc");
    for (const key of ["page", "redirect", "action"]) expect(first.has(key)).toBe(false);
  });
});

describe("saved contact views", () => {
  it("recovers from corrupt or unexpected local storage without breaking the toolbar", () => {
    for (const raw of [null, "", "{", '{"name":"not an array"}', "null", "42", '[null,4,{"name":4},{"name":"Missing query"}]']) {
      expect(readContactViews(raw)).toEqual([]);
    }
  });

  it("restores a saved filter scope independently of its old page and strips unsupported query fields", () => {
    const saved = readContactViews(JSON.stringify([{ name: "  Follow up  ", query: "q=Ana&view=hot&page=8&pageSize=50&owner=Vance&redirect=https%3A%2F%2Foutside.example" }]));
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Follow up");
    const restored = new URLSearchParams(saved[0].query);
    expect(restored.get("q")).toBe("Ana");
    expect(restored.get("view")).toBe("hot");
    expect(restored.get("owner")).toBe("Vance");
    expect(restored.get("pageSize")).toBe("50");
    expect(restored.has("page")).toBe(false);
    expect(restored.has("redirect")).toBe(false);
  });

  it("keeps an explicit All scope so a saved view does not inherit later preferences", () => {
    const saved = readContactViews(JSON.stringify([{ name: "Ana", query: "q=Ana" }]));
    const restored = resolveContactsQuery(Object.fromEntries(new URLSearchParams(saved[0].query)), { view: "booked", pageSize: 50 });
    expect(restored.filter.search).toBe("Ana");
    expect(restored.filter.view).toBeUndefined();
    expect(new URLSearchParams(restored.query).get("view")).toBe("all");
  });

  it("replaces duplicate names with the latest scope and ignores blank names", () => {
    const saved = readContactViews(JSON.stringify([{ name: "Review", query: "view=hot" }, { name: " ", query: "view=clients" }, { name: "Review", query: "view=booked" }]));
    expect(saved).toHaveLength(1);
    expect(new URLSearchParams(saved[0].query).get("view")).toBe("booked");
  });
});
