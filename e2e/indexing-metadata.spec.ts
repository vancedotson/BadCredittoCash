import { expect, test, type Page, type TestInfo } from "@playwright/test";

const privateRoutes = [
  { path: "/login?state=invalid-login", label: "login" },
  { path: "/forgot-password?state=reset-sent", label: "forgot password" },
  { path: "/auth/update-password?state=invalid-link", label: "password update" },
  { path: "/webinar/confirmed?state=quiz-1", label: "webinar confirmation" },
  { path: "/webinar/booked?state=booking-generic", label: "webinar booking confirmation" },
  { path: "/live/confirmed?preview=1", label: "live webinar confirmation" },
  { path: "/live/booked?preview=1", label: "live booking confirmation" },
  { path: "/credit-check/thank-you", label: "credit-check thank-you" },
] as const;

const publicRoutes = ["/", "/credit-check", "/book", "/live", "/privacy", "/terms"] as const;

async function isolateLocalPage(page: Page, testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Indexing metadata tests require E2E_BASE_URL to point to a local production server.");
  }

  const localOrigin = new URL(baseURL).origin;
  if (!["localhost", "127.0.0.1"].includes(new URL(localOrigin).hostname)) {
    throw new Error(`Refusing non-local browser traffic from indexing metadata tests: ${localOrigin}`);
  }

  const blockedRequests: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestURL = new URL(request.url());

    if (
      requestURL.origin !== localOrigin ||
      !["GET", "HEAD"].includes(request.method()) ||
      requestURL.pathname.startsWith("/api/")
    ) {
      blockedRequests.push(`${request.method()} ${requestURL.origin}${requestURL.pathname}`);
      await route.abort();
      return;
    }

    await route.continue();
  });

  return { blockedRequests, localOrigin };
}

async function expectNoindex(page: Page, routeLabel: string) {
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  const directives = (robots ?? "").split(",").map((directive) => directive.trim().toLowerCase());
  expect(directives, `${routeLabel} should emit robots noindex,nofollow`).toContain("noindex");
  expect(directives, `${routeLabel} should emit robots noindex,nofollow`).toContain("nofollow");
}

test("private and post-conversion routes render noindex,nofollow in production HTML", async ({ page }, testInfo) => {
  const { blockedRequests } = await isolateLocalPage(page, testInfo);

  for (const route of privateRoutes) {
    await test.step(route.label, async () => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route.path} should render locally`).toBe(200);
      await expectNoindex(page, route.label);
    });
  }

  expect(blockedRequests.every((request) => request.startsWith("POST ") || request.includes("/api/"))).toBe(true);
});

test("public routes stay indexable and /book and /live have route-specific metadata", async ({ page }, testInfo) => {
  const { blockedRequests } = await isolateLocalPage(page, testInfo);

  for (const path of publicRoutes) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${path} should render locally`).toBe(200);
    const robotsTag = page.locator('meta[name="robots"]');
    const robots = (await robotsTag.count())
      ? ((await robotsTag.getAttribute("content"))?.toLowerCase() ?? "")
      : "";
    expect(robots, `${path} should remain indexable`).not.toContain("noindex");
  }

  await page.goto("/book", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Book a Free Strategy Call/);
  const bookDescription = await page.locator('meta[name="description"]').getAttribute("content");
  expect(bookDescription).toBe(
    "Schedule a free 30-minute phone call with Vance Dotson to review collector calls, credit report issues, and possible next steps.",
  );

  await page.goto("/live", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Free Live Session on Debt Collector Conduct/);
  const liveDescription = await page.locator('meta[name="description"]').getAttribute("content");
  expect(liveDescription).toBe(
    "Join a free online session with Vance Dotson to learn which debt collector conduct the FDCPA restricts and what to document.",
  );
  expect(liveDescription).not.toBe(bookDescription);
  expect(blockedRequests.every((request) => request.startsWith("POST ") || request.includes("/api/"))).toBe(true);
});

test("robots.txt allows public crawling and disallows only the requested private routes", async ({ page }, testInfo) => {
  const { blockedRequests } = await isolateLocalPage(page, testInfo);
  const response = await page.goto("/robots.txt", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  const body = await response?.text();
  expect(body).toContain("User-Agent: *");
  expect(body).toContain("Allow: /");
  for (const path of [
    "/crm",
    "/login",
    "/forgot-password",
    "/auth/",
    "/api/",
    "/credit-check/thank-you",
    "/webinar/confirmed",
    "/webinar/booked",
    "/live/confirmed",
    "/live/booked",
  ]) {
    expect(body).toContain(`Disallow: ${path}`);
  }
  expect(body).not.toMatch(/^Sitemap:/im);
  expect(blockedRequests).toEqual([]);
});
