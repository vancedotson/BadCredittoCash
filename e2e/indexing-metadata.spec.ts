import { expect, test, type Page, type TestInfo } from "./fixtures/local-safe-page";

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

  const blockedRequests: Array<{
    method: string;
    url: string;
    reason: "off-origin" | "api" | "unsafe-method";
  }> = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestURL = new URL(request.url());

    const reason =
      requestURL.origin !== localOrigin
        ? "off-origin"
        : requestURL.pathname.startsWith("/api/")
          ? "api"
          : !["GET", "HEAD"].includes(request.method())
            ? "unsafe-method"
            : null;

    if (reason) {
      blockedRequests.push({ method: request.method(), url: request.url(), reason });
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

function expectAccurateBlockReasons(
  blockedRequests: Array<{ method: string; url: string; reason: "off-origin" | "api" | "unsafe-method" }>,
  localOrigin: string,
) {
  const misclassifiedRequests = blockedRequests.filter(({ method, url, reason }) => {
    const requestURL = new URL(url);
    if (reason === "off-origin") return requestURL.origin === localOrigin;
    if (reason === "api") return requestURL.origin !== localOrigin || !requestURL.pathname.startsWith("/api/");
    return requestURL.origin !== localOrigin || requestURL.pathname.startsWith("/api/") || ["GET", "HEAD"].includes(method);
  });

  expect(
    misclassifiedRequests,
    `Blocked requests were assigned an incorrect safety reason. Offending method/URL/reason: ${JSON.stringify(misclassifiedRequests, null, 2)}. All blocked requests: ${JSON.stringify(blockedRequests, null, 2)}`,
  ).toEqual([]);
}

test("private and post-conversion routes render noindex,nofollow in production HTML", async ({ page }, testInfo) => {
  const { blockedRequests, localOrigin } = await isolateLocalPage(page, testInfo);

  for (const route of privateRoutes) {
    await test.step(route.label, async () => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route.path} should render locally`).toBe(200);
      await expectNoindex(page, route.label);
    });
  }

  expectAccurateBlockReasons(blockedRequests, localOrigin);
});

test("public routes stay indexable and /book and /live have route-specific metadata", async ({ page }, testInfo) => {
  const { blockedRequests, localOrigin } = await isolateLocalPage(page, testInfo);

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
  expectAccurateBlockReasons(blockedRequests, localOrigin);
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
