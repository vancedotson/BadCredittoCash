import { expect, test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    if (typeof baseURL !== "string") {
      throw new Error("These E2E checks require E2E_BASE_URL to point to a local production server.");
    }

    const localOrigin = new URL(baseURL).origin;
    if (!["localhost", "127.0.0.1"].includes(new URL(localOrigin).hostname)) {
      throw new Error(`Refusing non-local browser traffic from E2E checks: ${localOrigin}`);
    }

    await page.route("**/*", async (route) => {
      const request = route.request();
      const requestURL = new URL(request.url());

      if (
        requestURL.origin !== localOrigin ||
        requestURL.pathname.startsWith("/api/") ||
        !["GET", "HEAD"].includes(request.method())
      ) {
        await route.abort();
        return;
      }

      await route.continue();
    });

    // `use` is Playwright's fixture callback here, not a React hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };
export type { Page, TestInfo } from "@playwright/test";
