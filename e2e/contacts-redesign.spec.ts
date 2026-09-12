import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Contacts redesign tests require an explicit localhost E2E_BASE_URL.");
  }
  // Every mutation is intercepted; these checks never change customer records.
  await page.route("**/api/crm/**", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      await route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    } else await route.continue();
  });
});

async function openContacts(page: Page, query = "") {
  await page.goto(`/crm/contacts${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Contacts", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add contact", exact: true })).toBeEnabled();
}

async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /^Filters/ });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(page.getByRole("combobox", { name: "Stage", exact: true })).toBeVisible();
}

async function expectAccessible(page: Page, selector = '[data-testid="contacts-workspace"]') {
  const result = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations, result.violations.map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(" ")).join("\n")}`).join("\n")).toEqual([]);
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function openImport(page: Page) {
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import contacts (CSV)", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function uploadCsv(dialog: Locator, text: string, name = "contacts.csv") {
  await dialog.getByLabel("Choose CSV file", { exact: true }).setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text) });
  await expect(dialog.getByRole("button", { name: "Preview import", exact: true })).toBeEnabled();
}

test("filter changes clear selection and reset the displayed search value", async ({ page }) => {
  await openContacts(page);
  await page.getByRole("checkbox", { name: "Select all", exact: true }).check();
  await expect(page.getByRole("combobox", { name: "Set stage", exact: true })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Search", exact: true });
  await search.fill("Ana Martins");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=Ana\+Martins/);
  await expect(page.getByRole("link", { name: "Ana Martins", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Set stage", exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Select all", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("button", { name: "All contacts", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).searchParams.get("q")).toBeNull();
});

test("filters retain the effective scope in export links and clear incompatible session filters", async ({ page }) => {
  await openContacts(page, "?q=Ana&owner=Vance&view=all&funnel=live&sessionId=123e4567-e89b-42d3-a456-426614174000&page=2");
  await openFilters(page);
  await expect(page.getByRole("combobox", { name: "Session", exact: true })).toHaveValue("123e4567-e89b-42d3-a456-426614174000");
  await page.getByRole("combobox", { name: "Funnel", exact: true }).selectOption("evergreen");
  await expect(page).toHaveURL(/funnel=evergreen/);
  const current = new URL(page.url()).searchParams;
  expect(current.get("sessionId")).toBeNull();
  expect(current.get("page")).toBeNull();
  expect(current.get("q")).toBe("Ana");
  const exportHref = await page.getByRole("link", { name: "Export all CSV", exact: true }).getAttribute("href");
  const exported = new URL(exportHref!, page.url()).searchParams;
  expect(exported.get("q")).toBe("Ana");
  expect(exported.get("owner")).toBe("Vance");
  expect(exported.get("funnel")).toBe("evergreen");
  expect(exported.get("sessionId")).toBeNull();
  expect(exported.get("view")).toBeNull();
});

test("malformed saved views recover and saved searches restore without a stale page", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("crm-contact-views", '{"unexpected":true}'));
  await openContacts(page, "?q=Ana&view=all&page=2");
  await page.getByText("Saved views", { exact: true }).click();
  await expect(page.getByText("No saved views yet.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "View name", exact: true }).fill("Ana follow-up");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("crm-contact-views") || "[]")) as Array<{ name: string; query: string }>;
  expect(saved).toHaveLength(1);
  expect(saved[0].name).toBe("Ana follow-up");
  expect(new URLSearchParams(saved[0].query).get("page")).toBeNull();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search", exact: true })).toHaveValue("");
  if (!await page.getByRole("button", { name: "Ana follow-up", exact: true }).isVisible()) await page.getByText("Saved views", { exact: true }).click();
  await page.getByRole("button", { name: "Ana follow-up", exact: true }).click();
  await expect(page).toHaveURL(/q=Ana/);
  await expect(page.getByRole("textbox", { name: "Search", exact: true })).toHaveValue("Ana");
});

test("native contact dialog contains keyboard focus and returns it to its trigger", async ({ page }) => {
  await openContacts(page);
  const trigger = page.getByRole("button", { name: "+ Add contact", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add contact", exact: true });
  await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
  for (let index = 0; index < 14; index++) {
    await page.keyboard.press("Tab");
    // Native dialogs can yield to browser chrome; background page controls stay inert.
    expect(await dialog.evaluate((element) => element.matches(":modal") && (!document.hasFocus() || element.contains(document.activeElement)))).toBe(true);
  }
  await expectAccessible(page, "dialog[open]");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("adding a contact keeps failed details and sends the same draft on retry", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill(requests.length === 1 ? { status: 409, json: { error: "This email already exists." } } : { status: 200, json: { ok: true } });
  });
  await openContacts(page);
  await page.getByRole("button", { name: "+ Add contact", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add contact", exact: true });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Design Review");
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("design-review@example.com");
  await dialog.getByRole("button", { name: "Add contact", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("This email already exists.");
  await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Design Review");
  await dialog.getByRole("button", { name: "Add contact", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0]).toMatchObject({ name: "Design Review", email: "design-review@example.com", stage: "new", source: "manual" });
});

test("bulk requests freeze selection and report affected contacts accurately", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contacts/bulk", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await held;
    await route.fulfill({ status: 200, json: { ok: true, affected: 2 } });
  });
  await openContacts(page);
  await page.getByRole("checkbox", { name: "Select all", exact: true }).check();
  await page.getByRole("combobox", { name: "Set stage", exact: true }).selectOption("engaged");
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByRole("checkbox", { name: "Select all", exact: true })).toBeDisabled();
  await expect(page.getByRole("combobox", { name: "Set stage", exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole("status").filter({ hasText: /2 contacts/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select all", exact: true })).not.toBeChecked();
  expect(requests[0]).toMatchObject({ action: "stage", value: "engaged" });
});

test("all-matching selection can exclude one contact without silently dropping other pages", async ({ page }) => {
  const requests: Array<{ ids: string[]; action: string; value: string }> = [];
  await page.route("**/api/crm/contacts/bulk", async (route) => {
    const body = route.request().postDataJSON() as { ids: string[]; action: string; value: string };
    requests.push(body);
    await route.fulfill({ status: 200, json: { ok: true, affected: body.ids.length } });
  });
  await openContacts(page, "?pageSize=5&view=all");
  const table = page.getByRole("table");
  await expect(table.getByRole("checkbox")).toHaveCount(6);
  await table.getByRole("checkbox", { name: "Select all", exact: true }).check();
  await page.getByRole("button", { name: "Select all 17 matching contacts", exact: true }).click();
  await table.getByRole("checkbox").nth(1).uncheck();
  await expect(page.getByRole("button", { name: "Export selected", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Set stage", exact: true }).selectOption("engaged");
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].ids).toHaveLength(16);
  expect(new Set(requests[0].ids).size).toBe(16);
});

test("row editing preserves concurrency tokens and failed field values", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact/*", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 409, json: { error: "This contact changed. Refresh and try again." } });
  });
  await openContacts(page);
  await page.getByRole("button", { name: "Manage Ana Martins", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Ana Martins", exact: true });
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("engaged");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("This contact changed");
  await expect(dialog.getByRole("combobox", { name: "Stage", exact: true })).toHaveValue("engaged");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ stage: "engaged", expectedUpdatedAt: expect.any(String) });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("CSV preview keeps quoted multiline values and mapping changes require another review", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/import", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    await route.fulfill({ status: 200, json: body.mode === "commit" ? { ok: true, imported: 1, skipped: 0 } : { ok: true, preview: true, summary: { total: 1, valid: 1, invalid: 0, newContacts: 1, updates: 0 }, issues: [] } });
  });
  await openContacts(page);
  const dialog = await openImport(page);
  await uploadCsv(dialog, 'Name,Email,Source\r\n"Joan, \"\"JJ\"\"\nSmith",joan-review@example.com,Referral');
  await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Import 1 valid", exact: true })).toBeVisible();
  expect(requests[0]).toMatchObject({ mode: "preview", contacts: [{ name: 'Joan, "JJ"\nSmith', email: "joan-review@example.com", source: "Referral" }] });
  await dialog.getByRole("combobox", { name: "Source", exact: true }).selectOption("");
  await expect(dialog.getByRole("button", { name: "Preview import", exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Import 1 valid", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Import 1 valid", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Imported 1; skipped 0");
  expect(requests).toHaveLength(3);
  expect(requests[2]).toMatchObject({ mode: "commit", confirm: "IMPORT", contacts: requests[1].contacts });
  await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("CSV preview blocks edits and dismissal while it is pending", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/crm/import", async (route) => {
    await held;
    await route.fulfill({ status: 200, json: { ok: true, preview: true, summary: { total: 1, valid: 1, invalid: 0, newContacts: 1, updates: 0 }, issues: [] } });
  });
  await openContacts(page);
  const dialog = await openImport(page);
  await uploadCsv(dialog, "Name,Email\nReview,review@example.com");
  await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
  await expect(dialog.getByLabel("Choose CSV file", { exact: true })).toBeDisabled();
  await expect(dialog.getByRole("combobox", { name: "Name", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  release();
  await expect(dialog.getByRole("button", { name: "Import 1 valid", exact: true })).toBeEnabled();
});

test("rejected replacement files cannot leave an earlier import enabled", async ({ page }) => {
  await page.route("**/api/crm/import", async (route) => route.fulfill({ status: 200, json: { ok: true, preview: true, summary: { total: 1, valid: 1, invalid: 0, newContacts: 1, updates: 0 }, issues: [] } }));
  await openContacts(page);
  const dialog = await openImport(page);
  await uploadCsv(dialog, "Name,Email\nReview,review@example.com");
  await dialog.getByRole("button", { name: "Preview import", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Import 1 valid", exact: true })).toBeEnabled();
  await dialog.getByLabel("Choose CSV file", { exact: true }).setInputFiles({ name: "too-large.csv", mimeType: "text/csv", buffer: Buffer.alloc(2_000_001, "x") });
  await expect(dialog.getByRole("alert")).toContainText("2 MB");
  await expect(dialog.getByRole("button", { name: "Import 1 valid", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Preview import", exact: true })).toBeDisabled();
});

for (const theme of ["light", "dark"] as const) {
  test(`contacts and expanded filters are accessible in ${theme} theme`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await openContacts(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expectAccessible(page);
    await openFilters(page);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Saved views", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "View name", exact: true })).toBeFocused();
    await expectAccessible(page);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Import CSV", exact: true }).click();
    await expectAccessible(page, "dialog[open]");
  });
}

test("mobile cards and dialogs fit the viewport with usable filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openContacts(page);
  await expectNoOverflow(page);
  await openFilters(page);
  await page.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Vance");
  await expect(page).toHaveURL(/owner=Vance/);
  await expect(page.getByRole("link", { name: "Ana Martins", exact: true }).first()).toBeVisible();
  await expectNoOverflow(page);
  await expectAccessible(page);
  const dialog = await openImport(page);
  await uploadCsv(dialog, "Name,Email,Phone,Source,Owner,Stage\nReview,review@example.com,,Referral,Vance,New");
  await expectNoOverflow(page);
  await expectAccessible(page, "dialog[open]");
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(844);
});
