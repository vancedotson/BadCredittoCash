import { expect, test } from "@playwright/test";

test("booking confirmation shows appointment and calendar actions", async ({ page }) => {
  await page.goto("/webinar/booked?state=booking-details");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/your call is booked/i);
  await expect(page.getByText("Your 30-minute appointment")).toBeVisible();
  await expect(page.getByText(/send the appointment time by email/i)).toBeVisible();
  await expect(page.getByText(/need to change the time/i)).toBeVisible();
  await expect(page.getByRole("link", { name: `Call (405) 555-0123` }).first()).toHaveAttribute("href", "tel:+14055550123");
  await expect(page.getByRole("link", { name: "Add to Google Calendar" })).toHaveAttribute(
    "href",
    /calendar\.google\.com\/calendar\/render/,
  );
  await expect(page.getByRole("link", { name: "AnnualCreditReport.com" })).toHaveAttribute(
    "href",
    "https://www.annualcreditreport.com/",
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Apple / Outlook (.ics)", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vance-dotson-strategy-call.ics");
});

test("generic confirmation explains where to find appointment details", async ({ page }) => {
  await page.goto("/webinar/booked?state=booking-generic");

  await expect(page.getByText(/check your email for the appointment time and call details/i)).toBeVisible();
  await expect(page.getByText("Your 30-minute appointment")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add to Google Calendar" })).toHaveCount(0);
});

test("saved booking details survive the redirect to confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("vance:last-booking", JSON.stringify({
      id: "e2e-safe-booking",
      name: "E2E Safe Test",
      startsAt: "2026-09-01T15:00:00.000Z",
      endsAt: "2026-09-01T15:30:00.000Z",
      timezone: "UTC",
    }));
  });
  await page.goto("/webinar/booked");

  await expect(page.getByText("Your 30-minute appointment")).toBeVisible();
  await expect(page.getByText(/3:00 PM.*3:30 PM/i)).toBeVisible();
});
