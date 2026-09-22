import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const viewports = [
  { name: "320px", width: 320, height: 800 },
  { name: "390px", width: 390, height: 844 },
  { name: "768px", width: 768, height: 900 },
  { name: "1280px", width: 1280, height: 900 },
] as const;

async function isolateLocalPage(page: Page, testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Public accessibility tests require E2E_BASE_URL to point to a local Next.js server.");
  }

  const localOrigin = new URL(baseURL).origin;
  if (!["localhost", "127.0.0.1"].includes(new URL(localOrigin).hostname)) {
    throw new Error(`Refusing non-local browser traffic from public accessibility tests: ${localOrigin}`);
  }

  const blockedRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestURL = new URL(request.url());

    if (
      requestURL.origin !== localOrigin ||
      !["GET", "HEAD"].includes(request.method())
    ) {
      blockedRequests.push(`${request.method()} ${requestURL.origin}${requestURL.pathname}`);
      await route.abort();
      return;
    }

    await route.continue();
  });

  return { blockedRequests, localOrigin };
}

async function expectFullAxeScan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations.map(({ id, help }) => `${id}: ${help}`),
  ).toEqual([]);
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function settleVisualState(page: Page) {
  // The homepage intentionally animates its first render. Freeze presentation
  // effects so axe evaluates the final contrast palette rather than a
  // transient opacity/color during the entrance animation.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
}

async function contrastRatio(locator: Locator) {
  return locator.evaluate((element) => {
    type Color = [number, number, number, number];

    function parseColor(value: string): Color | null {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const channels = match[1].split(",").map((channel) => Number.parseFloat(channel.trim()));
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
    }

    function composite(foreground: Color, background: [number, number, number]): [number, number, number] {
      return [
        foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
        foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
        foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
      ];
    }

    function relativeLuminance([red, green, blue]: [number, number, number]) {
      const linear = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    }

    const foreground = parseColor(getComputedStyle(element).color);
    if (!foreground) throw new Error("Expected a computed RGB foreground color.");

    const ancestors: Element[] = [];
    for (let current: Element | null = element; current; current = current.parentElement) ancestors.push(current);
    let background: [number, number, number] = [255, 255, 255];
    for (const ancestor of ancestors.reverse()) {
      const parsed = parseColor(getComputedStyle(ancestor).backgroundColor);
      if (parsed && parsed[3] > 0) background = composite(parsed, background);
    }

    const foregroundLuminance = relativeLuminance(composite(foreground, background));
    const backgroundLuminance = relativeLuminance(background);
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  });
}

async function expectPrimaryButtonsReadable(page: Page) {
  const buttons = page.locator(".v3-btn-primary");
  await expect(buttons.first()).toBeVisible();

  for (const button of await buttons.all()) {
    await expect(contrastRatio(button)).resolves.toBeGreaterThanOrEqual(4.5);
    await button.hover();
    await expect(contrastRatio(button)).resolves.toBeGreaterThanOrEqual(4.5);
  }
}

async function focusButtonWithKeyboard(page: Page, button: Locator) {
  for (let tabCount = 0; tabCount < 80; tabCount += 1) {
    if (await button.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }

  await expect(button).toBeFocused();
}

for (const viewport of viewports) {
  test(`public homepage and credit-check accessibility at ${viewport.name}`, async ({ page }, testInfo) => {
    const safety = await isolateLocalPage(page, testInfo);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto("/");
    await settleVisualState(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator("main main")).toHaveCount(0);
    await expect(page.locator("main").getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.locator("header").first().evaluate((header) => header.closest("main"))).toBeNull();
    await expect(page.locator('nav[aria-label="Primary navigation"]')).toHaveCount(1);
    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open menu", exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation", exact: true })).toHaveCount(1);
    }
    await expectFullAxeScan(page);
    await expectPrimaryButtonsReadable(page);
    await expectNoOverflow(page);

    const heroButton = page.locator("main .v3-btn-primary").first();
    await expect(heroButton).toContainText("Check my credit report, free");
    await expect(heroButton).toHaveAttribute("href", "/credit-check");
    await focusButtonWithKeyboard(page, heroButton);
    await expect(contrastRatio(heroButton)).resolves.toBeGreaterThanOrEqual(4.5);
    expect(await heroButton.evaluate((element) => element.matches(":focus-visible"))).toBe(true);
    expect(
      safety.blockedRequests.every((request) => {
        const [method, url] = request.split(" ", 2);
        return !["GET", "HEAD"].includes(method) || !url.startsWith(safety.localOrigin);
      }),
    ).toBe(true);

    await page.goto("/credit-check");
    await settleVisualState(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".cc-v2-progress")).toBeVisible();
    await expectFullAxeScan(page);
    await expect(contrastRatio(page.locator(".cc-v2-progress > div").nth(1))).resolves.toBeGreaterThanOrEqual(4.5);
    await expectNoOverflow(page);
  });
}

for (const viewport of [
  { name: "390px", width: 390, height: 844 },
  { name: "1280px", width: 1280, height: 900 },
] as const) {
  test(`shared primary-button consumer remains accessible at ${viewport.name}`, async ({ page }, testInfo) => {
    await isolateLocalPage(page, testInfo);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/book?state=booking-contact-error");
    await settleVisualState(page);
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expectFullAxeScan(page);
    await expectPrimaryButtonsReadable(page);
    await expectNoOverflow(page);
  });
}
