import { expect, test } from "@playwright/test";

test("anonymous visitors cannot open the CRM", async ({ page }) => {
  await page.goto("/crm");

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "CRM sign in" })).toBeVisible();
  await expect(page.getByText("Authorized team members only.")).toBeVisible();
});
