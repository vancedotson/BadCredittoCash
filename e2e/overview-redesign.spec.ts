import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const sections = [
  "Needs attention", "Last 7 days", "New contacts & booking events", "Pipeline",
  "Evergreen webinar funnel", "Engagement", "Audience segments", "Acquisition sources", "Recent activity",
];

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Overview redesign tests require an explicit localhost E2E_BASE_URL.");
  }
  // Every mutation is mocked; these tests never create or change customer records.
  await page.route("**/api/crm/**", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      await route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    } else await route.continue();
  });
});

async function openOverview(page: Page, query = "") {
  await page.goto(`/crm${query}`);
  await expect(page.getByRole("heading", { name: "Overview", level: 1, exact: true })).toBeVisible();
  await expect(page.getByTestId("overview-dashboard").getByRole("button", { name: "+ Contact", exact: true })).toBeEnabled();
}

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function expectAccessible(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations, results.violations.map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(" ")).join("\n")}`).join("\n")).toEqual([]);
}

async function openQuickAction(page: Page, kind: "contact" | "task") {
  const trigger = page.getByTestId("overview-dashboard").getByRole("button", { name: kind === "contact" ? "+ Contact" : "+ Task", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: `Add ${kind}`, exact: true });
  await expect(dialog).toBeVisible();
  return { dialog, trigger };
}

test("entire overview is readable on mobile and exposes explanations on demand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openOverview(page);
  for (const name of sections) {
    const heading = page.getByRole("heading", { name, exact: true });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expectNoPageOverflow(page);
  }
  const method = page.getByText("Forecast method", { exact: true });
  await method.click();
  await expect(page.getByText(/Forecast weights each contact by stage/)).toBeVisible();
  await page.getByText("View daily numbers", { exact: true }).click();
  const daily = page.locator("details").filter({ hasText: "View daily numbers" });
  await expect(daily.getByRole("table")).toBeVisible();
  await expect(daily.getByRole("row")).toHaveCount(31);
  await expectNoPageOverflow(page);
});

for (const theme of ["light", "dark"] as const) {
  test(`overview has accessible ${theme} colors, names, and chart alternatives`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await openOverview(page, "?owner=__all__");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expectAccessible(page, '[data-testid="overview-dashboard"]');
    await page.getByText("View daily numbers", { exact: true }).click();
    await page.getByText("Forecast method", { exact: true }).click();
    await expectAccessible(page, '[data-testid="overview-dashboard"]');
  });
}

test("range and owner filters retain honest scopes and reset the displayed work queue", async ({ page }) => {
  await openOverview(page);
  const owner = page.getByRole("combobox", { name: "Owner", exact: true });
  const queue = page.getByRole("region", { name: "Needs attention", exact: true });
  await expect(owner).toHaveValue("Vance");
  await expect(queue.getByRole("button", { name: /^Complete / })).toHaveCount(0);
  await page.getByRole("button", { name: "90d", exact: true }).click();
  await expect(page).toHaveURL(/range=90/);
  await expect(page.getByRole("button", { name: "90d", exact: true })).toHaveAttribute("aria-pressed", "true");
  const metrics = page.getByRole("region", { name: "Key metrics", exact: true });
  const newContacts = metrics.getByRole("link").filter({ has: page.getByText("New contacts", { exact: true }) });
  await expect(newContacts).toContainText("Last 90 days");
  await expect(newContacts).toContainText("No prior-period baseline");
  await expect(metrics.getByRole("link").filter({ has: page.getByText("Booking / registration", { exact: true }) })).toContainText("All-time observed ratio");
  const trend = page.locator("section").filter({ has: page.getByRole("heading", { name: "New contacts & booking events", exact: true }) });
  await expect(trend).toContainText(/30 days/);
  await expect(page.getByRole("heading", { name: "Last 7 days", exact: true })).toBeVisible();
  await expect(page.getByText(/Contact owner/).first()).toBeVisible();
  await owner.selectOption("__all__");
  await expect(page).toHaveURL(/owner=__all__/);
  await expect(queue.getByRole("button", { name: /^Complete / }).first()).toBeVisible();
  await owner.selectOption("Vance");
  await expect(owner).toHaveValue("Vance");
  await expect(queue.getByRole("button", { name: /^Complete / })).toHaveCount(0);
  await page.getByRole("button", { name: "7d", exact: true }).click();
  await expect(page.getByRole("button", { name: "7d", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(trend).toContainText(/7 days/);
});

test("contact drill-throughs preserve owner and segment or source filters", async ({ page }) => {
  await openOverview(page);
  const dashboard = page.getByTestId("overview-dashboard");
  const scopedReports = dashboard.getByRole("region", { name: /^(Key metrics|Audience segments|Acquisition sources)$/ });
  const contactLinks = await scopedReports.locator('a[href^="/crm/contacts?"]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  expect(contactLinks.length).toBeGreaterThan(3);
  for (const href of contactLinks) {
    const params = new URL(href).searchParams;
    expect(params.get("owner")).toBe("Vance");
    expect(params.get("view")).toBe("all");
  }
  expect(contactLinks.some((href) => new URL(href).searchParams.has("segment"))).toBe(true);
  expect(contactLinks.some((href) => new URL(href).searchParams.has("source"))).toBe(true);
  const recent = dashboard.getByRole("region", { name: "Recent activity", exact: true });
  await expect(recent).toContainText("All owners · Independent of the date filter");
  expect(await recent.locator('a[href^="/crm/contacts?"]').evaluateAll((links) => links.every((link) => !new URL((link as HTMLAnchorElement).href).searchParams.has("owner")))).toBe(true);
  await page.getByRole("combobox", { name: "Owner", exact: true }).selectOption("__all__");
  await expect(page).toHaveURL(/owner=__all__/);
  await expect.poll(async () => dashboard.locator('a[href^="/crm/contacts?"]').evaluateAll((links) => links.every((link) => !new URL((link as HTMLAnchorElement).href).searchParams.has("owner")))).toBe(true);
});

test("queue completion remains reversible and failed actions retain their work item", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  let reject = true;
  await page.route("**/api/crm/task", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill(reject ? { status: 503, json: { error: "Task service unavailable." } } : { json: { ok: true } });
  });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await openOverview(page, "?owner=__all__");
  const queue = page.getByRole("region", { name: "Needs attention", exact: true });
  const complete = queue.getByRole("button", { name: /^Complete / }).first();
  const label = (await complete.getAttribute("aria-label"))!;
  await complete.click();
  await expect(queue.getByRole("alert")).toContainText("Task service unavailable.");
  await expectAccessible(page, '[data-testid="overview-dashboard"]');
  await expect(queue.getByRole("button", { name: label, exact: true })).toBeEnabled();
  reject = false;
  await queue.getByRole("button", { name: label, exact: true }).click();
  await expect(queue.getByRole("button", { name: label, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(queue.getByRole("button", { name: label, exact: true })).toBeVisible();
  expect(writes.map((write) => write.done)).toEqual([true, true, false]);
  expect(writes.every((write) => write.id === writes[0].id)).toBe(true);
});

async function fillContact(dialog: Locator) {
  await dialog.getByLabel("Name", { exact: true }).fill("Overview Test Contact");
  await dialog.getByLabel("Email", { exact: true }).fill("overview-test@example.com");
}

test("contact quick action keeps failed drafts and prevents duplicate pending saves", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/crm/contact", async (route) => {
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) await route.fulfill({ status: 503, json: { error: "Contact service unavailable." } });
    else {
      await held;
      await route.fulfill({ json: { ok: true } });
    }
  });
  await openOverview(page);
  const { dialog, trigger } = await openQuickAction(page, "contact");
  await fillContact(dialog);
  await dialog.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Overview Test Contact");
  await expect(dialog.getByLabel("Email", { exact: true })).toHaveValue("overview-test@example.com");
  await dialog.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Saving|Creating/ })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(writes).toHaveLength(2);
  release();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes[1]).toMatchObject({ name: "Overview Test Contact", email: "overview-test@example.com", stage: "new" });
});

test("task quick action preserves the API contract and closes accessibly after save", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/task", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await openOverview(page);
  const { dialog, trigger } = await openQuickAction(page, "task");
  await dialog.getByLabel("Task title", { exact: true }).fill("Follow up after the webinar");
  await dialog.getByLabel("Contact", { exact: true }).selectOption({ label: "Ana Martins" });
  await dialog.getByLabel("Priority", { exact: true }).selectOption("high");
  await dialog.getByLabel("Owner", { exact: true }).selectOption("Team");
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-12-01");
  await dialog.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ email: "ana@example.com", title: "Follow up after the webinar", type: "follow_up", priority: "high", owner: "Team" });
  expect(new Date(String(writes[0].dueDate)).getTime()).not.toBeNaN();
});

for (const kind of ["contact", "task"] as const) {
  test(`${kind} dialog supports keyboard dismissal and fits mobile in both themes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openOverview(page);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      const { dialog, trigger } = await openQuickAction(page, kind);
      await expectAccessible(page, "dialog");
      await expectNoPageOverflow(page);
      const submit = dialog.getByRole("button", { name: `Create ${kind}`, exact: true });
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  });
}
