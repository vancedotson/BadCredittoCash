import { expect, test, type Locator, type Page } from "@playwright/test";

const unexpectedMutations = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Notification popup checks require an explicit localhost E2E_BASE_URL.");
  }
  await page.addInitScript(() => localStorage.setItem("crm-collapsed", "0"));
  unexpectedMutations.set(page, []);
  // Notification actions are explicitly mocked in the interaction checks. No
  // browser regression may otherwise mutate CRM records or notifications.
  await page.route("**/api/crm/**", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      unexpectedMutations.get(page)!.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    } else await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  expect(unexpectedMutations.get(page) ?? []).toEqual([]);
});

async function openNotifications(page: Page) {
  await page.goto("/crm/tasks");
  await expect(page.getByRole("heading", { name: "Tasks", exact: true, level: 1 })).toBeVisible();
  if (page.viewportSize()!.width < 768) {
    await page.getByRole("button", { name: "Open CRM menu", exact: true }).click();
    await page.getByRole("menuitem", { name: /Notifications/ }).click();
  } else {
    const expand = page.getByRole("button", { name: "Expand sidebar", exact: true });
    if (await expand.isVisible()) await expand.click();
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
  }
  const markAllRead = page.getByRole("button", { name: "Mark all read", exact: true }).filter({ visible: true });
  await expect(markAllRead).toBeVisible();
  return markAllRead.locator("xpath=../../..");
}

async function expectWithinViewport(page: Page, element: Locator) {
  const viewport = page.viewportSize()!;
  const bounds = await element.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x, "Popup must not extend beyond the left viewport edge").toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
}

for (const viewport of [
  { width: 1536, height: 960 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 480 },
  { width: 320, height: 360 },
  { width: 768, height: 360 },
]) {
  test(`notifications stay fully visible at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const popup = await openNotifications(page);
    await expectWithinViewport(page, popup);
    for (const control of [
      popup.getByText("Notifications", { exact: true }),
      popup.getByRole("button", { name: "Mark all read", exact: true }),
      popup.getByRole("link", { name: "View all in Overview", exact: true }),
    ]) {
      await expect(control).toBeVisible();
      await expectWithinViewport(page, control);
    }
    expect(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (viewport.height === 360) {
      const list = popup.locator(".crm-scroll");
      expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      const lastNotification = list.getByRole("button", { name: /^Dismiss / }).last();
      await lastNotification.scrollIntoViewIfNeeded();
      await expectWithinViewport(page, lastNotification);
      expect(await list.evaluate((element) => element.scrollTop > 0)).toBe(true);
      await expectWithinViewport(page, popup.getByRole("button", { name: "Mark all read", exact: true }));
      await expectWithinViewport(page, popup.getByRole("link", { name: "View all in Overview", exact: true }));
    }
  });
}

test("dismissing a notification only sends its dismissal and removes its row", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 960 });
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/notifications", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  const popup = await openNotifications(page);
  const dismissButtons = popup.getByRole("button", { name: /^Dismiss / });
  const initialCount = await dismissButtons.count();
  expect(initialCount).toBeGreaterThan(0);
  const dismissedLabel = await dismissButtons.first().getAttribute("aria-label");
  await dismissButtons.first().click();
  await expect(dismissButtons).toHaveCount(initialCount - 1);
  await expect(popup.getByRole("button", { name: dismissedLabel!, exact: true })).toHaveCount(0);
  expect(requests).toEqual([{ id: expect.any(String), action: "dismiss" }]);
  await expect(popup).toBeVisible();
});

test("mark all read sends one read per unread notification and keeps the list", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 960 });
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/notifications", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  const popup = await openNotifications(page);
  const count = await popup.getByRole("button", { name: /^Dismiss / }).count();
  await popup.getByRole("button", { name: "Mark all read", exact: true }).click();
  await expect.poll(() => requests.length).toBe(count);
  expect(requests.every((request) => request.action === "read" && typeof request.id === "string")).toBe(true);
  expect(new Set(requests.map((request) => request.id)).size).toBe(count);
  await expect(popup.getByRole("button", { name: /^Dismiss / })).toHaveCount(count);
  await expect(popup.getByText("0", { exact: true })).toBeVisible();
  await popup.getByRole("button", { name: "Mark all read", exact: true }).click();
  expect(requests).toHaveLength(count);
});

test("opening a notification marks it read and navigates to its contact", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 960 });
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/notifications", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  const popup = await openNotifications(page);
  await popup.getByRole("button", { name: /^Re-send the booking link/ }).click();
  await expect(page).toHaveURL(/\/crm\/contacts\/[^/?]+$/);
  expect(requests).toEqual([{ id: expect.any(String), action: "read" }]);
  await expect(page.getByRole("button", { name: "Mark all read", exact: true })).toHaveCount(0);
});

test("View all in Overview closes the popup and navigates without notification writes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const popup = await openNotifications(page);
  await popup.getByRole("link", { name: "View all in Overview", exact: true }).click();
  await expect(page).toHaveURL(/\/crm$/);
  await expect(page.getByRole("button", { name: "Mark all read", exact: true })).toHaveCount(0);
});
