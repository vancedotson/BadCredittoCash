import { expect, test, type Page } from "./fixtures/local-safe-page";

const unavailableMessage = "This service is temporarily unavailable. Please try again later.";

async function installLocalTurnstile(page: Page) {
  await page.addInitScript(() => {
    window.turnstile = {
      render: (_element, options) => {
        queueMicrotask(() => options.callback("local-safe-test-token"));
        return "local-safe-test-widget";
      },
      remove: () => {},
    };
  });
}

test("registration 503 keeps details, focuses retry guidance, and does not emit failure analytics", async ({ page }) => {
  const postedApiPaths: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path.startsWith("/api/")) postedApiPaths.push(path);
  });
  await installLocalTurnstile(page);
  await page.route("**/api/lead", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: unavailableMessage }),
  }));

  await page.goto("/#register");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await email.fill("local-safe@example.test");
  await name.fill("Local Safe Test");
  const requestsBeforeSubmit = postedApiPaths.length;

  await page.getByRole("button", { name: /send me the free training/i }).click();

  const alert = page.getByRole("alert").filter({ hasText: unavailableMessage });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(email).toHaveValue("local-safe@example.test");
  await expect(name).toHaveValue("Local Safe Test");
  await expect(page).toHaveURL(/#register$/);
  expect(postedApiPaths.slice(requestsBeforeSubmit)).toEqual(["/api/lead"]);
});

test("booking 503 preserves contact and appointment details without emitting failure analytics", async ({ page }) => {
  const postedApiPaths: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path.startsWith("/api/")) postedApiPaths.push(path);
  });
  await installLocalTurnstile(page);
  await page.route("**/api/book", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ startsAt: [], busy: [] }) });
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: unavailableMessage }),
    });
  });

  await page.goto("/book");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("local-safe@example.test");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Local Safe Test");
  await page.getByRole("button", { name: "Continue to choose a time", exact: true }).click();
  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await page.getByRole("button", { name: "9:00 AM", exact: true }).click();
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("radio").nth(3).check();
  await page.getByRole("combobox", { name: /how soon/i }).selectOption({ label: "As soon as possible" });
  const requestsBeforeSubmit = postedApiPaths.length;

  await page.getByRole("button", { name: "Confirm my call", exact: true }).click();

  const alert = page.getByRole("alert").filter({ hasText: unavailableMessage });
  await expect(alert).toBeVisible();
  await expect(alert).toBeFocused();
  await expect(page.getByText(/selected:.*9:00 AM/i)).toBeVisible();
  await expect(page.getByRole("radio").nth(0)).toBeChecked();
  await expect(page.getByRole("radio").nth(3)).toBeChecked();
  await expect(page.getByRole("combobox", { name: /how soon/i })).toHaveValue("As soon as possible");
  await expect(page).toHaveURL(/\/book$/);
  expect(await page.evaluate(() => sessionStorage.getItem("vance:last-booking"))).toBeNull();
  expect(postedApiPaths.slice(requestsBeforeSubmit)).toEqual(["/api/book"]);

  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("local-safe@example.test");
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Local Safe Test");
});
