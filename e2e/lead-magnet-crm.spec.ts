import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const unexpectedMutations = new WeakMap<Page, string[]>();
const privateReportRequests = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, context, baseURL }) => {
  if (!process.env.E2E_BASE_URL || !baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Lead magnet checks require an explicit localhost E2E_BASE_URL.");
  }
  const writes: string[] = [];
  const reports: string[] = [];
  unexpectedMutations.set(page, writes);
  privateReportRequests.set(page, reports);
  // These checks only read synthetic demo data. Block remote traffic and every
  // write, including server actions, before any page or popup can navigate.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort("blockedbyclient");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    }
    if (/^\/api\/crm\/contact\/[^/]+\/reports(?:\/|$)/.test(url.pathname)) {
      reports.push(url.pathname);
      return route.fulfill({ status: 403, json: { error: "Private reports are unavailable in this browser check." } });
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(async ({ page }) => {
  expect(unexpectedMutations.get(page), "No writes may reach the CRM or public intake").toEqual([]);
  expect(privateReportRequests.get(page), "Demo reports must never query private report endpoints").toEqual([]);
});

async function openLeadMagnet(page: Page, query = "") {
  await page.goto(`/crm/lead-magnet${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Lead magnet", exact: true })).toBeVisible();
  await expect(page.getByText(/fictional|sample data|demo data|demo preview/i).first()).toBeVisible();
}

function reportButtons(page: Page) {
  return page.getByRole("button", { name: /^View reports for / }).filter({ visible: true });
}

function reportStatus(page: Page) {
  return page.getByRole("navigation", { name: "Report status", exact: true });
}

test("the expanded navigation remains reachable on short desktop screens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await openLeadMagnet(page);
  const secondary = page.getByRole("navigation", { name: "Secondary CRM pages", exact: true });
  const settings = secondary.getByRole("link", { name: "Settings", exact: true });
  await settings.scrollIntoViewIfNeeded();
  await expect(settings).toBeInViewport();
  expect(await settings.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
  })).toBe(true);
  await secondary.getByRole("link", { name: "Lead magnet", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lead magnet", exact: true })).toBeVisible();
});

async function chooseStatus(page: Page, label: string, status: string | null) {
  await reportStatus(page).getByRole("button", { name: new RegExp(`^${label}(?:\\s|$)`) }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe(status);
  expect(new URL(page.url()).searchParams.get("page")).toBeNull();
}

async function openReports(page: Page) {
  const trigger = reportButtons(page).first();
  const name = (await trigger.getAttribute("aria-label"))!.replace(/^View reports for /, "");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name, exact: true });
  await expect(dialog).toBeVisible();
  return { dialog, trigger, name };
}

async function expectAccessible(page: Page, include: string) {
  const result = await new AxeBuilder({ page }).include(include)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations, result.violations.map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(" ")).join("\n")}`).join("\n")).toEqual([]);
}

async function expectNoOverflow(page: Page, dialog?: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (!dialog) return;
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

test("lead magnet is reachable from the sidebar and command search", async ({ page }) => {
  await page.goto("/crm/contacts?view=all");
  const navigation = page.getByRole("link", { name: "Lead magnet", exact: true }).filter({ visible: true });
  await expect(navigation).toHaveAttribute("href", "/crm/lead-magnet");
  await navigation.click();
  await expect(page.getByRole("heading", { level: 1, name: "Lead magnet", exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  const search = page.getByPlaceholder("Search contacts or jump to…", { exact: true });
  await expect(search).toBeFocused();
  await search.fill("Lead magnet");
  await page.getByRole("button", { name: "Lead magnet Go to", exact: true }).click();
  await expect(search).toHaveCount(0);
  await expect(page).toHaveURL(/\/crm\/lead-magnet$/);
});

test("signup metrics stay global while report status filters narrow the list", async ({ page }) => {
  await openLeadMagnet(page);
  const summary = page.getByRole("region", { name: "Lead magnet summary", exact: true });
  for (const label of ["Total signups", "New in 30 days", "Waiting for PDFs", "All 3 received"]) {
    await expect(summary.getByText(label, { exact: true })).toBeVisible();
  }
  for (const metric of [/Total signups\s*3/, /New in 30 days\s*2/, /Waiting for PDFs\s*1/, /All 3 received\s*1/]) {
    await expect(summary).toContainText(metric);
  }
  const initialSummary = await summary.innerText();
  await expect(reportButtons(page)).toHaveCount(3);
  const matches: string[] = [];
  for (const [label, status] of [["Waiting for PDFs", "waiting"], ["Some PDFs", "partial"], ["All 3 received", "complete"]]) {
    await chooseStatus(page, label, status);
    await expect(reportButtons(page)).toHaveCount(1);
    matches.push((await reportButtons(page).first().getAttribute("aria-label"))!);
    expect(await summary.innerText()).toBe(initialSummary);
  }
  expect(matches).toEqual(["View reports for Evan Wright", "View reports for Grace Okafor", "View reports for Ana Martins"]);
  await chooseStatus(page, "All signups", null);
  await expect(reportButtons(page)).toHaveCount(3);
  expect(await summary.innerText()).toBe(initialSummary);
});

test("search submits to the URL, combines with report status, and recovers from no matches", async ({ page }) => {
  await openLeadMagnet(page, "?status=complete");
  const name = (await reportButtons(page).first().getAttribute("aria-label"))!.replace(/^View reports for /, "");
  const search = page.getByRole("searchbox", { name: "Search lead magnet signups", exact: true });
  await search.fill(name.toUpperCase());
  await page.getByRole("main").getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(name.toUpperCase());
  expect(new URL(page.url()).searchParams.get("status")).toBe("complete");
  await expect(reportButtons(page)).toHaveCount(1);
  await chooseStatus(page, "Waiting for PDFs", "waiting");
  expect(new URL(page.url()).searchParams.get("q")).toBe(name.toUpperCase());
  await expect(reportButtons(page)).toHaveCount(0);
  await expect(page.getByText(/no .*match/i).first()).toBeVisible();
  await search.fill("");
  await page.getByRole("main").getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBeNull();
  await expect(reportButtons(page)).toHaveCount(1);
});

test("status changes reset an out-of-range page while preserving the current search", async ({ page }) => {
  await openLeadMagnet(page, "?q=example&status=partial&page=99");
  await chooseStatus(page, "All signups", null);
  expect(new URL(page.url()).searchParams.get("q")).toBe("example");
  await expect(reportButtons(page)).toHaveCount(3);
});

test("report dialog uses sample receipts, contains focus, and returns focus on Escape", async ({ page }) => {
  await openLeadMagnet(page, "?status=complete");
  const { dialog, trigger } = await openReports(page);
  expect(await dialog.evaluate((element) => element.matches(":modal") && element.contains(document.activeElement))).toBe(true);
  for (const bureau of ["TransUnion", "Equifax", "Experian"]) {
    await expect(dialog.getByText(bureau, { exact: true })).toBeVisible();
  }
  await expect(dialog.locator('a[download], a[href*="/reports/"]')).toHaveCount(0);
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => !document.hasFocus() || element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("mobile navigation includes the lead magnet workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm/contacts?view=all");
  await page.getByRole("button", { name: "Open CRM menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Lead magnet", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lead magnet", exact: true })).toBeVisible();
  await expect(page.getByRole("menu", { name: "More CRM pages", exact: true })).toHaveCount(0);
  await expectNoOverflow(page);
});

for (const theme of ["light", "dark"] as const) {
  test(`desktop workspace and report dialog are accessible in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await openLeadMagnet(page, "?status=partial");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expectNoOverflow(page);
    await expectAccessible(page, "main");
    const { dialog } = await openReports(page);
    await expectNoOverflow(page, dialog);
    await expectAccessible(page, "dialog[open]");
  });

  test(`mobile workspace and report dialog fit and are accessible in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await openLeadMagnet(page, "?status=complete");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expectNoOverflow(page);
    await expectAccessible(page, "main");
    const { dialog } = await openReports(page);
    await expectNoOverflow(page, dialog);
    await expectAccessible(page, "dialog[open]");
    await page.setViewportSize({ width: 320, height: 568 });
    await expectNoOverflow(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expectNoOverflow(page);
  });
}
