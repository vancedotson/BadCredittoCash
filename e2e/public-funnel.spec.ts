import { expect, test } from "@playwright/test";

test("public homepage reaches the registration form", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Vance Dotson/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/calls/i);

  await page.getByRole("link", { name: /see how it works, free/i }).first().click();

  await expect(page.locator("#register")).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /open my case/i })).toBeVisible();
});
