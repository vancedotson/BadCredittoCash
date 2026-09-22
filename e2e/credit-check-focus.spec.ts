import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const scenarios = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "200% zoom equivalent", width: 640, height: 450 },
] as const;

async function isolateLocalGuide(page: Page, baseURL: string | undefined) {
  if (!baseURL) {
    throw new Error("Credit-check focus tests require E2E_BASE_URL to point to a local Next.js server.");
  }

  const localOrigin = new URL(baseURL).origin;
  if (!["localhost", "127.0.0.1"].includes(new URL(localOrigin).hostname)) {
    throw new Error(`Refusing non-local browser traffic from credit-check focus tests: ${localOrigin}`);
  }

  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    if (requestUrl.origin !== localOrigin || !["GET", "HEAD"].includes(request.method())) {
      await route.abort();
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      if (requestUrl.pathname === "/api/credit-check/reports/session" && request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            sessionId: "local-e2e-guide-session",
            mode: "local",
            reports: [],
            handoffToken: "",
          }),
        });
        return;
      }

      // No other API request, including any upload, may reach the local app.
      await route.abort();
      return;
    }

    await route.continue();
  });
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
  test(`credit-check guide keyboard focus is visible with no layout shift or overflow at ${scenario.name}`, async ({ page, baseURL }) => {
    await isolateLocalGuide(page, baseURL);
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto("/credit-check/thank-you");

    const continueButton = await focusButtonWithKeyboard(page);
    await expect(continueButton).toBeFocused();
    await page.keyboard.press("Enter");

    const heading = page.locator("#cc-current-step");
    await expect(heading).toHaveText("Get all 3 credit reports.");
    await expect(heading).toBeFocused();

    const indicator = await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      const background = getComputedStyle(element.parentElement!).backgroundColor;
      const channels = (color: string) => color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const luminance = (color: string) => {
        const [r, g, b] = channels(color).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const foregroundLuminance = luminance(style.outlineColor);
      const backgroundLuminance = luminance(background);
      const contrast = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);

      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineColor: style.outlineColor,
        contrast,
        documentRect: (() => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height,
          };
        })(),
      };
    });

    expect(indicator.outlineStyle).toBe("solid");
    expect(indicator.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(indicator.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(indicator.contrast).toBeGreaterThanOrEqual(3);

    const axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);

    // Removing focus must not change the heading's layout box: CSS outlines
    // are painted outside the flow and should not move nearby content.
    await page.keyboard.press("Tab");
    const unfocusedDocumentRect = await heading.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    });
    expect(unfocusedDocumentRect).toEqual(indicator.documentRect);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
}
