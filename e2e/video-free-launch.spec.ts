import { expect, test } from "./fixtures/local-safe-page";

const retiredTrainingRoutes = ["/webinar/confirmed?state=quiz-1", "/webinar/room?state=room-preview"] as const;

test("homepage presents only the credit-report CTA", async ({ page }) => {
  const leadPosts: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/lead") && request.method() === "POST") leadPosts.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /start with your credit report/i })).toBeVisible();

  const visibleCopy = await page.locator("body").innerText();
  expect(visibleCopy).not.toMatch(/on-demand|private watch link/i);
  expect(await page.locator("#register form").count()).toBe(0);
  await expect(page.locator("#register").getByRole("link", { name: /check my credit report/i })).toHaveAttribute("href", "/credit-check");
  await expect(page.getByRole("link", { name: /join the webinar/i })).toHaveCount(0);
  await expect(page.locator('a[href="/live"], a[href="/book"]')).toHaveCount(0);

  const activeCtas = page.getByRole("link", { name: /check my credit report/i });
  const count = await activeCtas.count();
  expect(count).toBeGreaterThan(1);
  for (let index = 0; index < count; index += 1) {
    const href = await activeCtas.nth(index).getAttribute("href");
    expect(href, `Unexpected CTA destination: ${href}`).toBe("/credit-check");
  }
  expect(leadPosts).toEqual([]);
});

test("retired training routes redirect before rendering, while call booking remains available", async ({ page }) => {
  for (const path of retiredTrainingRoutes) {
    const redirects: Array<{ status: number; location: string | undefined }> = [];
    const routePath = new URL(path, "http://127.0.0.1").pathname;
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === routePath && response.status() >= 300 && response.status() < 400) {
        redirects.push({ status: response.status(), location: response.headers()["location"] });
      }
    });
    await page.goto(path);
    expect(redirects.some(({ status, location }) => status === 307 && location && new URL(location, "http://127.0.0.1").pathname === "/book")).toBe(true);
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/book your strategy call/i);
    await expect(page.getByText(/now playing|simulated|training video/i)).toHaveCount(0);
    page.removeAllListeners("response");
  }

  await page.goto("/webinar/call?state=booking-calendar");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/book your strategy call/i);
  await expect(page.getByText("STEP 2 / 2")).toBeVisible();

  await page.goto("/webinar/booked?state=booking-generic");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/your call is booked/i);
  await expect(page.getByText(/check your email for the appointment time and call details/i)).toBeVisible();
});
