import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const funnelRoutes = [
  { path: "/book", label: "standalone booking" },
  { path: "/webinar/call", label: "webinar booking" },
  { path: "/webinar/room?state=player-25", label: "webinar room" },
  { path: "/webinar/confirmed?state=quiz-1", label: "webinar confirmation" },
  { path: "/webinar/booked", label: "webinar booking confirmation" },
];

const bookingRoutes = funnelRoutes.slice(0, 2);

async function isolateLocalPage(page: Page, testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Booking landmark tests require E2E_BASE_URL to point to a local Next.js server.");
  }

  const localOrigin = new URL(baseURL).origin;
  const hostname = new URL(localOrigin).hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(`Refusing non-local browser traffic from booking landmark tests: ${localOrigin}`);
  }

  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());

    if (requestUrl.origin !== localOrigin) {
      await route.abort();
      return;
    }

    if (requestUrl.pathname.startsWith("/api/")) {
      if (requestUrl.pathname === "/api/book" && request.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ startsAt: [], busy: [], calendarStatus: "unavailable" }),
        });
        return;
      }

      // Block tracking and every mutation/API request; no test can write data.
      await route.abort();
      return;
    }

    await route.continue();
  });
}

async function expectOneShellMain(page: Page) {
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("main main")).toHaveCount(0);
  await expect(page.locator(".v3-content > header")).toHaveCount(1);
  await expect(page.locator(".v3-content > main")).toHaveCount(1);
  await expect(page.locator(".v3-content > header")).toBeVisible();
  expect(await page.locator(".v3-content > header").evaluate((header) => header.closest("main"))).toBeNull();
}

async function expectNoMainLandmarkAxeFindings(page: Page) {
  const results = await new AxeBuilder({ page })
    .withRules(["landmark-one-main", "region"])
    .analyze();

  expect(
    results.violations.map(({ id, help }) => `${id}: ${help}`),
  ).toEqual([]);
}

for (const route of funnelRoutes) {
  test(`${route.label} exposes one main landmark with the shell header outside it`, async ({ page }, testInfo) => {
    await isolateLocalPage(page, testInfo);
    await page.goto(route.path);
    await expectOneShellMain(page);
  });
}

for (const route of bookingRoutes) {
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "390px mobile", width: 390, height: 844 },
  ]) {
    for (const state of ["details", "calendar and intake"] as const) {
      test(`${route.label} ${state} state passes main-landmark axe checks at ${viewport.name}`, async ({ page }, testInfo) => {
        await isolateLocalPage(page, testInfo);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const stateQuery = state === "calendar and intake" ? "?state=booking-calendar" : "";
        await page.goto(`${route.path}${stateQuery}`);

        await expect(page.getByRole("heading", { level: 1, name: /book your free strategy call/i })).toBeVisible();
        await expectOneShellMain(page);

        if (state === "details") {
          await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
          await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
        } else {
          await expect(page.getByText("STEP 2 / 2")).toBeVisible();
          await expect(page.getByText("Choose a day")).toBeVisible();
          await expect(page.getByText("About your situation // 3 quick questions")).toBeVisible();
          await expect(page.getByRole("radio").first()).toBeVisible();
          await expect(page.getByRole("combobox", { name: /how soon/i })).toBeVisible();
        }

        await expectNoMainLandmarkAxeFindings(page);

        if (state === "details") {
          const continueButton = page.getByRole("button", { name: "Continue to choose a time", exact: true });
          await continueButton.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByText("Enter a valid email address.")).toBeVisible();
          await expect(page.getByText("Enter your name.")).toBeVisible();
          await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeFocused();
        }

        if (viewport.width === 390) {
          const dimensions = await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
        }
      });
    }
  }
}
