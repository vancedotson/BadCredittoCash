import { expect, test } from "@playwright/test";

test("confirmation page reaches the training and reveals its booking CTA", async ({ page }) => {
  await page.goto("/webinar/confirmed");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/training is ready/i);
  await expect(page.getByText("QUESTION 1 OF 3")).toBeVisible();

  await page.getByRole("link", { name: /prefer to skip/i }).click();
  await expect(page).toHaveURL(/\/webinar\/room$/);
  await expect(page.getByText("DEMO PLAYER // PLACEHOLDER")).toBeVisible();

  const player = page.getByRole("button", { name: "Play", exact: true }).first();
  await player.click();
  await expect(page.getByRole("button", { name: "Pause", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).first().click();

  const seek = page.getByRole("slider", { name: "Seek" });
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");
  await seek.press("ArrowRight");

  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toBeVisible();
});
