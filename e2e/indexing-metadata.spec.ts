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
const publicOrigin = "https://badcredittocash.com";
const publicMetadataRoutes = [
  {
    path: "/",
    title: "Vance Dotson — Stop the collector calls. Hold them accountable.",
    description:
      "A veteran consumer advocate who uses federal law (FCRA & FDCPA) to challenge inaccurate credit reporting and stop debt-collector harassment. Watch how it works — free.",
  },
  {
    path: "/credit-check",
    title: "Check the companies on your credit report",
    description:
      "Select the companies you recognize, share your contact details, and get the simple guide for pulling your three credit reports.",
  },
  {
    path: "/book",
    title: "Book a Free Strategy Call",
    description:
      "Schedule a free 30-minute phone call with Vance Dotson to review collector calls, credit report issues, and possible next steps.",
  },
  {
    path: "/live",
    title: "Free Live Session on Debt Collector Conduct",
    description:
      "Join a free online session with Vance Dotson to learn which debt collector conduct the FDCPA restricts and what to document.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description: "How Vance Dotson collects, uses, shares, and protects information submitted through this website.",
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Terms governing access to and use of the Vance Dotson website, training, credit-check and report-upload features, and booking services.",
  },
] as const;

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
  const sitemapLines = body?.match(/^Sitemap:.*$/gim) ?? [];
  expect(sitemapLines).toEqual([`Sitemap: ${publicOrigin}/sitemap.xml`]);
  expect(body).not.toMatch(/workers\.dev|vancedotson\.com|localhost/i);
  expect(blockedRequests).toEqual([]);
});

test("public routes emit canonical social metadata and a reachable large preview image", async ({ page }, testInfo) => {
  await isolateLocalPage(page, testInfo);
  let sharedImageUrl: URL | undefined;

  for (const route of publicMetadataRoutes) {
    await test.step(route.path, async () => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route.path} should render locally`).toBe(200);

      const canonical = route.path === "/" ? publicOrigin : `${publicOrigin}${route.path}`;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", route.title);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", route.description);
      await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Vance Dotson");
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", route.title);
      await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", route.description);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);

      const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
      const twitterImage = await page.locator('meta[name="twitter:image"]').getAttribute("content");
      expect(ogImage).toBeTruthy();
      expect(twitterImage).toBe(ogImage);
      const parsedImage = new URL(ogImage!);
      expect(parsedImage.origin).toBe(publicOrigin);
      expect(parsedImage.pathname).toBe("/opengraph-image");
      await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
      await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
      await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
        "content",
        "Text-and-shape Bad Credit to Cash brand graphic with an abstract card illustration",
      );
      await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
        "content",
        "Text-and-shape Bad Credit to Cash brand graphic with an abstract card illustration",
      );

      const metadataValues = await page.locator("head").evaluate((head) => {
        const links = Array.from(head.querySelectorAll("link[rel=canonical]"), (link) => link.getAttribute("href") ?? "");
        const metas = Array.from(head.querySelectorAll("meta"), (meta) => meta.getAttribute("content") ?? "");
        return [document.title, ...links, ...metas].join("\n");
      });
      expect(metadataValues).not.toMatch(/workers\.dev|vancedotson\.com|localhost/i);
      sharedImageUrl = parsedImage;
    });
  }

  expect(sharedImageUrl).toBeDefined();
  const imageResponse = await page.goto(`${sharedImageUrl!.pathname}${sharedImageUrl!.search}`);
  expect(imageResponse?.status()).toBe(200);
  expect(imageResponse?.headers()["content-type"]).toContain("image/png");
  const png = await imageResponse!.body();
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test("sitemap.xml includes only canonical indexable public routes", async ({ page }, testInfo) => {
  await isolateLocalPage(page, testInfo);
  const response = await page.goto("/sitemap.xml", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-type"]).toMatch(/application\/xml|text\/xml/);

  const xml = await response!.text();
  const locations = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
  expect(locations).toEqual(publicMetadataRoutes.map(({ path }) => `${publicOrigin}${path === "/" ? "/" : path}`));
  expect(locations.every((url) => new URL(url).origin === publicOrigin)).toBe(true);
  expect(xml).not.toMatch(/workers\.dev|vancedotson\.com|localhost|\/crm|\/api\/|\/login|\/forgot-password|\/auth\/|\/confirmed|\/booked|thank-you|\/v[14](?:<|\/)/i);
});
