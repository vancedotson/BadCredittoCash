import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Contact quick-edit checks require an explicit localhost E2E_BASE_URL.");
  }
  // Never let a browser check change an actual contact or task, even if a more
  // specific request mock stops matching as the UI evolves.
  await page.route("**/api/crm/**", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      await route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    } else await route.continue();
  });
});

async function openQuickEdit(page: Page, name = "Evan Wright") {
  await page.goto("/crm/contacts?view=all");
  await expect(page.getByRole("heading", { level: 1, name: "Contacts", exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: `Manage ${name}`, exact: true }).filter({ visible: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name, exact: true });
  await expect(dialog).toBeVisible();
  return { dialog, trigger };
}

async function expandTask(dialog: Locator) {
  const toggle = dialog.getByRole("button", { name: "Add a task", exact: true });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  const title = dialog.getByRole("textbox", { name: "Task title", exact: true });
  await expect(title).toBeVisible();
  return title;
}

async function addPriorityTag(dialog: Locator) {
  await dialog.getByRole("button", { name: /Add tag/ }).click();
  await dialog.getByRole("combobox", { name: "Choose a tag", exact: true }).selectOption("priority");
  await expect(dialog.getByRole("button", { name: "Remove tag priority", exact: true })).toBeVisible();
}

function savedContact(body: Record<string, unknown>, updatedAt = "2026-09-12T20:00:00.000Z") {
  return { ok: true, lead: { stage: body.stage, owner: body.owner || undefined, tags: body.tags, updatedAt } };
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).include("dialog[open]")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(result.violations, result.violations.map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(" ")).join("\n")}`).join("\n")).toEqual([]);
}

async function expectFooterInViewport(page: Page, dialog: Locator) {
  const viewport = page.viewportSize()!;
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  for (const name of ["Cancel", "Save changes"]) {
    const button = dialog.getByRole("button", { name, exact: true });
    await expect(button).toBeVisible();
    const buttonBounds = await button.boundingBox();
    expect(buttonBounds!.height).toBeGreaterThanOrEqual(44);
    expect(buttonBounds!.y + buttonBounds!.height).toBeLessThanOrEqual(viewport.height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

test("quick edit starts focused and collapsed, with no save until contact details change", async ({ page }) => {
  const { dialog, trigger } = await openQuickEdit(page);
  await expect(dialog.getByRole("button", { name: "Add a task", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByRole("textbox", { name: "Task title", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("combobox", { name: "Choose a tag", exact: true })).toHaveCount(0);
  await expect(dialog.getByText("No changes yet", { exact: true })).toBeVisible();
  const save = dialog.getByRole("button", { name: "Save changes", exact: true });
  await expect(save).toBeDisabled();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("engaged");
  await expect(save).toBeEnabled();
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("registered");
  await expect(save).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Vance");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toHaveValue("");
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
});

test("tag chips and contact fields save together with the original concurrency token", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact/*", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, json: savedContact(requests.at(-1)!) });
  });
  const { dialog } = await openQuickEdit(page);
  await addPriorityTag(dialog);
  await dialog.getByRole("button", { name: "Remove tag priority", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  await addPriorityTag(dialog);
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("engaged");
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Vance");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toEqual({ stage: "engaged", owner: "Vance", tags: ["priority"], expectedUpdatedAt: expect.any(String) });
  expect(Number.isNaN(Date.parse(requests[0].expectedUpdatedAt as string))).toBe(false);
});

test("adding a task independently retains every unsaved contact edit", async ({ page }) => {
  const taskRequests: Array<Record<string, unknown>> = [];
  const contactRequests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/task", async (route) => {
    taskRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.route("**/api/crm/contact/*", async (route) => {
    contactRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, json: savedContact(contactRequests.at(-1)!) });
  });
  const { dialog } = await openQuickEdit(page);
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("engaged");
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Team");
  await addPriorityTag(dialog);
  const title = await expandTask(dialog);
  await title.fill("  Send the next workshop details  ");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(dialog.getByRole("status").filter({ hasText: /Task added/ })).toBeVisible();
  expect(taskRequests).toEqual([{ email: "evan@example.com", title: "Send the next workshop details" }]);
  expect(contactRequests).toHaveLength(0);
  await expect(title).toHaveValue("");
  await expect(dialog.getByRole("combobox", { name: "Stage", exact: true })).toHaveValue("engaged");
  await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toHaveValue("Team");
  await expect(dialog.getByRole("button", { name: "Remove tag priority", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(contactRequests).toHaveLength(1);
  expect(contactRequests[0]).toEqual({ stage: "engaged", owner: "Team", tags: ["priority"], expectedUpdatedAt: expect.any(String) });
});

test("contact saves retain an unsubmitted task and refresh the concurrency token for later edits", async ({ page }) => {
  const contacts: Array<Record<string, unknown>> = [];
  const savedAt = "2026-09-12T20:00:00.000Z";
  let taskRequests = 0;
  await page.route("**/api/crm/contact/*", async (route) => {
    contacts.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, json: savedContact(contacts.at(-1)!, savedAt) });
  });
  await page.route("**/api/crm/task", async (route) => {
    taskRequests++;
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  const { dialog } = await openQuickEdit(page);
  const title = await expandTask(dialog);
  await title.fill("Still deciding on this task");
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Vance");
  await expect(dialog.getByText("This task is not added yet.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("status").filter({ hasText: "Contact changes saved. Your task draft is still here." })).toBeVisible();
  await expect(title).toHaveValue("Still deciding on this task");
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  expect(taskRequests).toBe(0);
  expect(contacts).toEqual([{ stage: "registered", owner: "Vance", tags: [], expectedUpdatedAt: expect.any(String) }]);
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("engaged");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  expect(contacts).toHaveLength(2);
  expect(contacts[1]).toEqual({ stage: "engaged", owner: "Vance", tags: [], expectedUpdatedAt: savedAt });
  expect(taskRequests).toBe(0);
  await expect(title).toHaveValue("Still deciding on this task");
});

test("failed saves keep edits and retry with the same concurrency token", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact/*", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill(requests.length === 1
      ? { status: 409, json: { error: "This contact changed. Refresh and try again." } }
      : { status: 200, json: savedContact(requests.at(-1)!) });
  });
  const { dialog } = await openQuickEdit(page);
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("engaged");
  await addPriorityTag(dialog);
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("This contact changed");
  await expect(dialog.getByRole("combobox", { name: "Stage", exact: true })).toHaveValue("engaged");
  await expect(dialog.getByRole("button", { name: "Remove tag priority", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0].expectedUpdatedAt).toEqual(expect.any(String));
});

test("a failed task remains editable and can retry without losing contact details", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/task", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill(requests.length === 1
      ? { status: 503, json: { error: "Task service is unavailable. Try again." } }
      : { status: 200, json: { ok: true } });
  });
  const { dialog } = await openQuickEdit(page);
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Vance");
  const title = await expandTask(dialog);
  await title.fill("Send registration details");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Task service is unavailable");
  await expect(title).toHaveValue("Send registration details");
  await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toHaveValue("Vance");
  await title.fill("Send workshop registration details");
  await dialog.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(dialog.getByRole("status").filter({ hasText: /Task added/ })).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toHaveValue("Vance");
  expect(requests).toEqual([
    { email: "evan@example.com", title: "Send registration details" },
    { email: "evan@example.com", title: "Send workshop registration details" },
  ]);
});

for (const operation of ["contact", "task"] as const) {
  test(`pending ${operation} requests lock edits, navigation, and dismissal`, async ({ page }) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    let requests = 0;
    await page.route(operation === "contact" ? "**/api/crm/contact/*" : "**/api/crm/task", async (route) => {
      requests++;
      await held;
      await route.fulfill({ status: 200, json: operation === "contact" ? savedContact(route.request().postDataJSON() as Record<string, unknown>) : { ok: true } });
    });
    const { dialog } = await openQuickEdit(page);
    await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Vance");
    const title = await expandTask(dialog);
    if (operation === "task") await title.fill("Pending task review");
    await dialog.getByRole("button", { name: operation === "contact" ? "Save changes" : "Add task", exact: true }).click();
    try {
      await expect.poll(() => requests).toBe(1);
      await expect(dialog.getByRole("combobox", { name: "Stage", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("combobox", { name: "Owner", exact: true })).toBeDisabled();
      await expect(title).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("button", { name: "Close contact actions", exact: true })).toBeDisabled();
      await expect(dialog.getByRole("link", { name: /Open full profile/ })).toHaveAttribute("aria-disabled", "true");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      expect(requests).toBe(1);
    } finally { release(); }
    if (operation === "contact") await expect(dialog).toHaveCount(0);
    else {
      await expect(dialog.getByRole("status").filter({ hasText: /Task added/ })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`desktop quick edit is accessible in ${theme}, including expanded controls and errors`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.route("**/api/crm/task", async (route) => route.fulfill({ status: 503, json: { error: "Could not add this task. Please try again." } }));
    const { dialog } = await openQuickEdit(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expectAccessible(page);
    await dialog.getByRole("button", { name: /Add tag/ }).click();
    const title = await expandTask(dialog);
    await expectAccessible(page);
    await title.fill("Review the accessibility of this task");
    await dialog.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expectAccessible(page);
    for (let index = 0; index < 16; index++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.matches(":modal") && (!document.hasFocus() || element.contains(document.activeElement)))).toBe(true);
    }
  });

  test(`mobile quick edit keeps its footer reachable and is accessible in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    const { dialog } = await openQuickEdit(page, "Ana Martins");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expectFooterInViewport(page, dialog);
    await expectAccessible(page);
    const title = await expandTask(dialog);
    await title.fill("Review the follow-up plan");
    await expectFooterInViewport(page, dialog);
    await expectAccessible(page);
    await page.setViewportSize({ width: 320, height: 568 });
    await expectFooterInViewport(page, dialog);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}
