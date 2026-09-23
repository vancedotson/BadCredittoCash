import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures/local-safe-page";

const proofCopy = /real cases on tape|trust the recorded calls|recorded calls?|documented outcomes|in their own words|500\s*\+\s*(?:people|clients|customers|oklahomans)?|4\.9|testimonials?|client results?/i;
const approvedLaunchHrefs = new Set(["/credit-check", "/book"]);

async function expectCleanLaunchPage(page: import("@playwright/test").Page, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("main main")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(proofCopy);
  for (const id of ["proof", "results", "statements"]) {
    await expect(page.locator(`#${id}`), `Removed proof section #${id} must not be present`).toHaveCount(0);
  }
  await expect(page.locator("#register form")).toHaveCount(0);
  await expect(page.locator("video, audio, [data-testid*=transcript i]")).toHaveCount(0);

  const nav = page.locator('nav[aria-label="Primary navigation"] a');
  const navLinks = await nav.evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href")));
  expect(navLinks.length).toBeGreaterThan(0);
  expect(navLinks.every((href) => href?.startsWith("#"))).toBe(true);
  const missingTargets = await nav.evaluateAll((anchors) => anchors
    .map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href") ?? "")
    .filter((href) => !document.getElementById(decodeURIComponent(href.slice(1)))));
  expect(missingTargets).toEqual([]);

  for (const cta of await page.locator("a.v3-btn").all()) {
    const href = await cta.getAttribute("href");
    expect(approvedLaunchHrefs.has(href ?? ""), `Unexpected launch CTA destination: ${href}`).toBe(true);
  }
  await expect(page.locator('#register a[href="/credit-check"]')).toBeVisible();
  await expect(page.locator('#register a[href="/book"]')).toBeVisible();

  if (width < 768) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const mobileNav = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
    await expect(mobileNav).toBeVisible();
    const mobileTargets = await mobileNav.locator("a").evaluateAll((anchors) => anchors
      .map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href") ?? "")
      .filter((href) => !document.getElementById(decodeURIComponent(href.slice(1)))));
    expect(mobileTargets).toEqual([]);
  }

  const primaryCta = page.locator('main a.v3-btn[href="/credit-check"]').first();
  for (let i = 0; i < 80; i += 1) {
    if (await primaryCta.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(primaryCta).toBeFocused();
  expect(await primaryCta.evaluate((element) => element.matches(":focus-visible"))).toBe(true);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
}

for (const viewport of [
  { name: "390px", width: 390 },
  { name: "1280px", width: 1280 },
]) {
  test(`launch homepage has no placeholder proof and remains accessible at ${viewport.name}`, async ({ page }) => {
    await expectCleanLaunchPage(page, viewport.width);
  });
}

test("/v4 stays in parity with the cleaned home and /v1spare redirects safely", async ({ page }) => {
  await page.goto("/");
  const homeHeading = await page.getByRole("heading", { level: 1 }).innerText();
  const homeChoices = await page.locator("#register").innerText();

  const alternate = await page.goto("/v4");
  expect(alternate?.status()).toBe(200);
  await expect(page).toHaveTitle("FCRA & FDCPA Information | Vance Dotson");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Learn about the FCRA and FDCPA, get a free credit-report guide, or book a free strategy call in Oklahoma City.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(homeHeading);
  expect(await page.locator("#register").innerText()).toBe(homeChoices);
  expect(await page.locator("body").innerText()).not.toMatch(proofCopy);
  await expect(page.locator("#proof, #results, #statements")).toHaveCount(0);

  const redirects: Array<{ status: number; location: string | undefined }> = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === "/v1spare" && response.status() >= 300 && response.status() < 400) {
      redirects.push({ status: response.status(), location: response.headers()["location"] });
    }
  });
  await page.goto("/v1spare");
  expect(redirects.some(({ status, location }) => status === 307 && location && new URL(location, "http://127.0.0.1").pathname === "/")).toBe(true);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(homeHeading);
});
