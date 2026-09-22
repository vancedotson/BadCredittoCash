import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const scenarios = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "200% zoom equivalent", width: 640, height: 450 },
] as const;

type SessionResponse = { status: 200 | 401 | 503; delayMs?: number };

const readySession = {
  ok: true,
  sessionId: "local-e2e-guide-session",
  mode: "local",
  reports: [],
  handoffToken: "",
};

async function isolateLocalGuide(page: Page, baseURL: string | undefined, responses: SessionResponse[]) {
  if (!baseURL) {
    throw new Error("Credit-check session tests require E2E_BASE_URL to point to a local Next.js server.");
  }

  const localOrigin = new URL(baseURL).origin;
  if (!["localhost", "127.0.0.1"].includes(new URL(localOrigin).hostname)) {
    throw new Error(`Refusing non-local browser traffic from credit-check session tests: ${localOrigin}`);
  }

  let sessionRequests = 0;
  const mutatingRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    if (requestUrl.origin !== localOrigin || !["GET", "HEAD"].includes(request.method())) {
      if (!["GET", "HEAD"].includes(request.method())) mutatingRequests.push(`${request.method()} ${requestUrl.pathname}`);
      await route.abort();
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      if (requestUrl.pathname === "/api/credit-check/reports/session" && request.method() === "GET") {
        const response = responses[Math.min(sessionRequests, responses.length - 1)];
        sessionRequests += 1;
        if (response.delayMs) await new Promise((resolve) => setTimeout(resolve, response.delayMs));
        await route.fulfill({
          status: response.status,
          contentType: "application/json",
          body: response.status === 200 ? JSON.stringify(readySession) : JSON.stringify({ error: "synthetic session response" }),
        });
        return;
      }

      // No other API request, including tracking or upload requests, may reach the local app.
      await route.abort();
      return;
    }

    await route.continue();
  });

  return {
    getSessionRequestCount: () => sessionRequests,
    getMutatingRequests: () => mutatingRequests,
  };
}

async function expectNoOverflowAndAxe(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const axeResults = await new AxeBuilder({ page }).analyze();
  expect(axeResults.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
}

async function focusButtonWithKeyboard(page: Page) {
  const button = page.getByRole("button", { name: "I'm on a computer", exact: true });

  for (let tabCount = 0; tabCount < 24; tabCount += 1) {
    if (await button.evaluate((element) => element === document.activeElement)) return button;
    await page.keyboard.press("Tab");
  }

  await expect(button).toBeFocused();
  return button;
}

for (const scenario of scenarios) {
  test(`credit-check missing session is announced without overflow at ${scenario.name}`, async ({ page, baseURL }) => {
    const requests = await isolateLocalGuide(page, baseURL, [{ status: 401, delayMs: 150 }]);
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto("/credit-check/thank-you");
    await focusButtonWithKeyboard(page);
    await page.keyboard.press("Enter");

    await expect(page.locator('.cc-upload-notice[role="status"]').filter({ hasText: "First, complete the quick check" })).toBeVisible();
    const guidance = page.locator('.cc-upload-notice[role="status"]');
    await expect(guidance).toHaveCount(1);
    await expect(guidance).toHaveAttribute("aria-live", "polite");
    await expect(guidance).toHaveAttribute("aria-atomic", "true");
    await expect(guidance).toContainText("If you switched devices, use the personal link you copied.");

    const recoveryLink = guidance.getByRole("link", { name: "Complete my quick check →", exact: true });
    await expect(recoveryLink).toHaveAttribute("href", "/credit-check");
    const fileInputs = page.locator('input[type="file"]');
    await expect(fileInputs).toHaveCount(3);
    for (const input of await fileInputs.all()) await expect(input).toBeDisabled();
    await expect(page.getByRole("button", { name: "Submit to Vance" })).toBeDisabled();

    const guidanceText = await guidance.textContent();
    await page.waitForTimeout(250);
    await expect(guidance).toHaveCount(1);
    await expect(guidance).toHaveText(guidanceText ?? "");
    expect(requests.getSessionRequestCount()).toBe(1);
    expect(requests.getMutatingRequests().some((request) => request.includes("/api/credit-check/reports/"))).toBe(false);
    await expectNoOverflowAndAxe(page);
  });
}

test("credit-check session preserves loading and recovers from a transient 503", async ({ page, baseURL }) => {
  const requests = await isolateLocalGuide(page, baseURL, [
    { status: 503, delayMs: 1000 },
    { status: 200 },
  ]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/credit-check/thank-you");
  await focusButtonWithKeyboard(page);
  await page.keyboard.press("Enter");

  await expect(page.locator('.cc-upload-notice[role="status"]').filter({ hasText: "Loading your upload slots…" })).toBeVisible();
  await expect(page.locator('.cc-upload-notice[role="alert"]')).toContainText("We couldn't load your upload slots. Please try again.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expectNoOverflowAndAxe(page);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Local preview · PDFs are saved on this computer.")).toBeVisible();
  await expect(page.locator('.cc-upload-notice[role="status"]')).toHaveCount(0);
  for (const input of await page.locator('input[type="file"]').all()) await expect(input).toBeEnabled();
  await expect(page.getByRole("button", { name: "Submit to Vance" })).toBeDisabled();
  expect(requests.getSessionRequestCount()).toBe(2);
  expect(requests.getMutatingRequests().some((request) => request.includes("/api/credit-check/reports/"))).toBe(false);
  await expectNoOverflowAndAxe(page);
});
