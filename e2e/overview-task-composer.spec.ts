import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Task composer checks require an explicit localhost E2E_BASE_URL.");
  }
  // Block every write unless a test explicitly mocks it; never change CRM data.
  await page.route("**/api/crm/**", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      await route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    } else await route.continue();
  });
});

async function openComposer(page: Page) {
  await page.goto("/crm");
  const trigger = page.getByTestId("overview-dashboard").getByRole("button", { name: "+ Task", exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add task", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Task title", exact: true })).toBeFocused();
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
  for (const name of ["Cancel", "Create task"]) {
    const button = dialog.getByRole("button", { name, exact: true });
    await expect(button).toBeInViewport();
    const buttonBounds = (await button.boundingBox())!;
    expect(buttonBounds.height).toBeGreaterThanOrEqual(44);
    expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(viewport.height);
  }
}

test("default and customized tasks keep the existing creation payload", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/task", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  let { dialog, trigger } = await openComposer(page);
  const firstContact = await dialog.getByRole("combobox", { name: "Contact", exact: true }).inputValue();
  expect(firstContact).not.toBe("");
  await expect(dialog.getByRole("radio", { name: "Follow-up", exact: true })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "Normal", exact: true })).toBeChecked();
  await dialog.getByRole("textbox", { name: "Task title", exact: true }).fill("  Review next steps  ");
  await dialog.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([{ email: firstContact, title: "Review next steps", type: "follow_up", priority: "normal", owner: "", dueDate: "" }]);

  ({ dialog, trigger } = await openComposer(page));
  await dialog.getByRole("textbox", { name: "Task title", exact: true }).fill("  Send the credit checklist  ");
  await dialog.getByRole("combobox", { name: "Contact", exact: true }).selectOption({ label: "Ana Martins" });
  await dialog.getByRole("radio", { name: "Document", exact: true }).check();
  await dialog.getByRole("radio", { name: "High", exact: true }).check();
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Team");
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-12-01");
  const expectedDate = await page.evaluate(() => new Date("2026-12-01T00:00:00").toISOString());
  await dialog.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({ email: "ana@example.com", title: "Send the credit checklist", type: "document", priority: "high", owner: "Team", dueDate: expectedDate });
});

test("radio choices work with the keyboard and Escape returns focus to Add task", async ({ page }) => {
  const { dialog, trigger } = await openComposer(page);
  await dialog.getByRole("radio", { name: "Follow-up", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Document", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Task", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Call", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Email", exact: true })).toBeChecked();
  await dialog.getByRole("radio", { name: "Normal", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "Low", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("radio", { name: "Normal", exact: true })).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("radio", { name: "High", exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("failed saves preserve the draft and pending retry prevents closing or duplicate submissions", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/crm/task", async (route) => {
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) await route.fulfill({ status: 503, json: { error: "Task service unavailable." } });
    else { await held; await route.fulfill({ json: { ok: true } }); }
  });
  const { dialog, trigger } = await openComposer(page);
  const title = dialog.getByRole("textbox", { name: "Task title", exact: true });
  await title.fill("Call to review the report");
  await dialog.getByRole("radio", { name: "Call", exact: true }).check();
  await dialog.getByRole("radio", { name: "High", exact: true }).check();
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Team");
  await dialog.getByLabel("Due date", { exact: true }).fill("2026-12-01");
  await dialog.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not create the task");
  await expect(title).toHaveValue("Call to review the report");
  await expect(dialog.getByRole("radio", { name: "Call", exact: true })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "High", exact: true })).toBeChecked();
  await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toHaveValue("Team");
  await expect(dialog.getByLabel("Due date", { exact: true })).toHaveValue("2026-12-01");
  await dialog.getByRole("button", { name: "Create task", exact: true }).click();
  try {
    await expect.poll(() => writes.length).toBe(2);
    await expect(dialog.getByRole("button", { name: /Creating/ })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Close task dialog", exact: true })).toBeDisabled();
    await expect(title).toBeDisabled();
    await expect(dialog.getByRole("radio", { name: "Email", exact: true })).toBeDisabled();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(writes).toHaveLength(2);
  } finally { release(); }
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes[1]).toEqual(writes[0]);
});

for (const theme of ["light", "dark"] as const) {
  test(`composer is accessible in ${theme} and keeps controls reachable at desktop and narrow mobile sizes`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      const { dialog, trigger } = await openComposer(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // Prevent theme transition colors from producing transient contrast results.
      await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
      await expectFitsViewport(page, dialog);
      const results = await new AxeBuilder({ page }).include("dialog[open]")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(results.violations, results.violations.map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(" ")).join("\n")}`).join("\n")).toEqual([]);
      for (const name of ["Call", "Email", "Follow-up", "Document", "Task", "High", "Normal", "Low"]) {
        const choice = dialog.getByRole("radio", { name, exact: true });
        await choice.scrollIntoViewIfNeeded();
        // Allow subpixel rounding at the shared borders of segmented choices.
        await expect(choice).toBeInViewport({ ratio: 0.99 });
        await choice.check();
        await expect(choice).toBeChecked();
      }
      await dialog.getByLabel("Due date", { exact: true }).scrollIntoViewIfNeeded();
      await expect(dialog.getByLabel("Due date", { exact: true })).toBeInViewport({ ratio: 1 });
      await dialog.getByRole("combobox", { name: "Owner", exact: true }).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toBeInViewport();
      await expectFitsViewport(page, dialog);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
  });
}
