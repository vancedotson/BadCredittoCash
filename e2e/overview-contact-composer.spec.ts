import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Contact composer checks require an explicit localhost E2E_BASE_URL.");
  }
  // A test must explicitly mock each write; never create or change CRM records.
  await page.route("**/*", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      await route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    } else await route.continue();
  });
});

async function openComposer(page: Page) {
  await page.goto("/crm");
  const trigger = page.getByTestId("overview-dashboard").getByRole("button", { name: "+ Contact", exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add contact", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
  return { dialog, trigger };
}

async function expectFitsViewport(page: Page, dialog: Locator) {
  const viewport = page.viewportSize()!;
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const name of ["Cancel", "Create contact"]) {
    const button = dialog.getByRole("button", { name, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
}

test("default and customized contacts preserve all fields, stages, and the exact creation payload", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  let { dialog, trigger } = await openComposer(page);
  await expect(dialog.getByRole("textbox", { name: "Source", exact: true })).toHaveValue("manual");
  await expect(dialog.getByRole("combobox", { name: "Stage", exact: true })).toHaveValue("new");
  await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toHaveValue("");
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Composer Test Contact");
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("composer-test@example.com");
  await dialog.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([{ name: "Composer Test Contact", email: "composer-test@example.com", phone: "", source: "manual", stage: "new", owner: "" }]);

  ({ dialog, trigger } = await openComposer(page));
  const stage = dialog.getByRole("combobox", { name: "Stage", exact: true });
  expect(await stage.locator("option").evaluateAll((options) => options.map((option) => ({ value: (option as HTMLOptionElement).value, label: option.textContent })))).toEqual([
    { value: "new", label: "New" }, { value: "registered", label: "Registered" },
    { value: "engaged", label: "Engaged" }, { value: "booked", label: "Call booked" },
    { value: "won", label: "Client" }, { value: "lost", label: "Lost" },
  ]);
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Referral Test Contact");
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("referral-test@example.com");
  await dialog.getByRole("textbox", { name: "Phone", exact: true }).fill("+1 (555) 010-0123");
  await dialog.getByRole("textbox", { name: "Source", exact: true }).fill("Local workshop / partner referral");
  await stage.selectOption("booked");
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Team");
  await dialog.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({ name: "Referral Test Contact", email: "referral-test@example.com", phone: "+1 (555) 010-0123", source: "Local workshop / partner referral", stage: "booked", owner: "Team" });
});

test("required fields and invalid email keep the dialog open without sending a request", async ({ page }) => {
  const writes: unknown[] = [];
  await page.route("**/api/crm/contact", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  const { dialog, trigger } = await openComposer(page);
  const name = dialog.getByRole("textbox", { name: "Name", exact: true });
  const email = dialog.getByRole("textbox", { name: "Email", exact: true });
  await dialog.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(name).toBeFocused();
  expect(await name.evaluate((element) => (element as HTMLInputElement).validity.valueMissing)).toBe(true);
  await name.fill("Validation Test Contact");
  await email.fill("not-an-email");
  await dialog.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(email).toBeFocused();
  expect(await email.evaluate((element) => (element as HTMLInputElement).validity.typeMismatch)).toBe(true);
  await expect(dialog).toBeVisible();
  expect(writes).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

for (const theme of ["light", "dark"] as const) {
  test(`contact composer is accessible in ${theme} and keeps every field reachable at desktop and narrow mobile sizes`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const viewport of [{ width: 1536, height: 1000 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      const { dialog, trigger } = await openComposer(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // Test settled theme colors, not the intermediate CSS transition frames.
      await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
      await expectFitsViewport(page, dialog);
      const results = await new AxeBuilder({ page }).include("dialog[open]")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations, results.violations.map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(" ")).join("\n")}`).join("\n")).toEqual([]);
      for (const name of ["Name", "Email", "Phone", "Source", "Stage", "Owner"]) {
        const control = dialog.getByRole(name === "Stage" || name === "Owner" ? "combobox" : "textbox", { name, exact: true });
        await control.scrollIntoViewIfNeeded();
        // Chromium rounds scroll offsets at fractional borders on narrow screens.
        await expect(control).toBeInViewport({ ratio: 0.99 });
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await expectFitsViewport(page, dialog);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  });
}
