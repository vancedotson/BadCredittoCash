import { expect, test } from "@playwright/test";

test("booking page selects a slot without creating a booking", async ({ page }) => {
  await page.route("**/api/book", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ startsAt: [], busy: [] }) });
      return;
    }
    await route.abort();
  });

  await page.goto("/book");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/book your free strategy call/i);

  await page.getByRole("textbox", { name: "Email", exact: true }).fill("p.burmesterm+vancee2esafe1@gmail.com");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("E2E Safe Test");
  await page.getByRole("button", { name: "Book my free call", exact: true }).click();

  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await expect(page.getByText("Choose a day")).toBeVisible();
  await page.getByRole("button", { name: "9:00 AM", exact: true }).click();
  await expect(page.getByText(/selected:.*9:00 AM/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm my call", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByText("STEP 1 / 2")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("p.burmesterm+vancee2esafe1@gmail.com");
});
