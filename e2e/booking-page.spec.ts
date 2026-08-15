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
  await expect(page.getByText("Your details", { exact: true })).toBeVisible();
  await expect(page.getByText(/free 30-minute phone call/i)).toBeVisible();
  await expect(page.getByText(/no cost\. no obligation\./i)).toBeVisible();

  await page.getByRole("textbox", { name: "Email", exact: true }).fill("p.burmesterm+vancee2esafe1@gmail.com");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("E2E Safe Test");
  await page.getByRole("button", { name: "Continue to choose a time", exact: true }).click();

  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await expect(page.getByText("Choose a day")).toBeVisible();
  await page.getByRole("button", { name: "9:00 AM", exact: true }).click();
  await expect(page.getByText(/selected:.*9:00 AM/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm my call", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /back/i }).click();
  await expect(page.getByText("STEP 1 / 2")).toBeVisible();
  await expect(page.getByText("Your details", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("p.burmesterm+vancee2esafe1@gmail.com");
});

test("webinar booking is clear and asks the customer to choose every answer", async ({ page }) => {
  await page.route("**/api/book", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ startsAt: [], busy: [] }) });
      return;
    }
    await route.abort();
  });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/webinar/call");

  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const onCall = page.getByText("On the call", { exact: true });
  await expect(email).toBeVisible();
  await expect(onCall).toBeAttached();
  expect(await email.evaluate((node) => node.getBoundingClientRect().top + window.scrollY))
    .toBeLessThan(await onCall.evaluate((node) => node.getBoundingClientRect().top + window.scrollY));

  const next = page.getByRole("button", { name: "Continue to choose a time", exact: true });
  await next.click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(email).toBeFocused();

  await email.fill("p.burmesterm+vancee2esafe2@gmail.com");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("E2E Safe Test");
  await next.click();

  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await expect(page.getByRole("radio").first()).not.toBeChecked();
  await expect(page.getByRole("combobox", { name: /how soon/i })).toHaveValue("");
});

test("direct booking calendar preview shows timezone and empty intake", async ({ page }) => {
  await page.goto("/book?state=booking-calendar");

  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await expect(page.getByText(/times shown in .+\(.+\)\./i)).toBeVisible();
  await expect(page.getByText("About your situation // 3 quick questions")).toBeVisible();
  await expect(page.getByText(/preview only\. use back/i)).toBeVisible();
  await expect(page.getByText(/security check didn't load/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm my call", exact: true })).toBeDisabled();
  await expect(page.getByRole("radio").first()).not.toBeChecked();
  await expect(page.getByRole("combobox", { name: /how soon/i })).toHaveValue("");

  const time = page.getByRole("button", { name: "9:00 AM", exact: true });
  await time.click();
  await expect(time).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/selected:.*9:00 AM/i)).toBeVisible();

  await page.locator('button[aria-pressed="false"][aria-label]').first().click();
  await expect(time).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("Pick a day and a time above.")).toBeVisible();
});

test("direct booking loading state locks repeat actions and keeps the selection visible", async ({ page }) => {
  const bookingRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/book")) bookingRequests.push(request.method());
  });

  await page.goto("/book?state=booking-loading");

  const form = page.locator('form[aria-busy="true"]');
  const confirm = page.getByRole("button", { name: /booking your call/i });

  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await expect(form).toBeVisible();
  await expect(page.getByText(/selected:.*9:00 AM/i)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /booking your call/i })).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAttribute("aria-describedby", "booking-loading-status");
  await expect(page.getByRole("button", { name: /back/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: "9:00 AM", exact: true })).toBeDisabled();
  await expect(page.getByRole("radio").first()).toBeDisabled();
  await expect(page.getByRole("combobox", { name: /how soon/i })).toBeDisabled();
  await page.waitForTimeout(500);
  expect(bookingRequests).toEqual([]);
});

test("availability error explains the problem and blocks unavailable booking", async ({ page }) => {
  const bookingRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/book")) bookingRequests.push(request.method());
  });

  await page.goto("/book?state=booking-availability-error");

  const alert = page.locator("#booking-availability-error");
  const confirm = page.getByRole("button", { name: "Confirm my call", exact: true });

  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await expect(alert).toContainText(/couldn't load live appointment times/i);
  await expect(alert).toContainText(/details are safe/i);
  await expect(page.getByRole("button", { name: "Retry availability", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "9:00 AM", exact: true })).toBeDisabled();
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveAttribute("aria-describedby", "booking-availability-error");
  expect(bookingRequests).toEqual([]);
});

test("slot taken state marks the old time and focuses the next available choice", async ({ page }) => {
  const bookingRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/book")) bookingRequests.push(request.method());
  });

  await page.goto("/book?state=booking-error");

  const alert = page.locator("#booking-slot-error");
  const taken = page.getByRole("button", { name: /^9:00 AM/ });
  const replacement = page.getByRole("button", { name: "11:00 AM", exact: true });

  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  await expect(alert).toContainText(/time was just booked/i);
  await expect(alert).toContainText(/choose another available time/i);
  await expect(taken).toBeDisabled();
  await expect(taken).toContainText(/booked/i);
  await expect(replacement).toBeFocused();

  await replacement.click();
  await expect(replacement).toHaveAttribute("aria-pressed", "true");
  await expect(alert).toHaveCount(0);
  await expect(page.getByText(/selected:.*11:00 AM/i)).toBeVisible();
  expect(bookingRequests).toEqual([]);
});

test("generic booking confirmation gives useful next steps without inventing appointment details", async ({ page }) => {
  await page.goto("/webinar/booked?state=booking-generic");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/your call is booked/i);
  await expect(page.getByText(/check your email for the appointment time and call details/i)).toBeVisible();
  await expect(page.getByText("Your 30-minute appointment")).toHaveCount(0);
  await expect(page.getByText("Start here // before we talk")).toBeVisible();
  await expect(page.getByRole("link", { name: "AnnualCreditReport.com", exact: true })).toHaveAttribute(
    "href",
    "https://www.annualcreditreport.com/",
  );
  await expect(page.getByRole("link", { name: /call \(405\) 555-0123/i })).toHaveAttribute("href", "tel:+14055550123");
  await expect(page.getByRole("link", { name: "Back to the case file", exact: true })).toHaveAttribute("href", "/");
});

test("direct booking contact error focuses the problem and preserves good details", async ({ page }) => {
  const bookingRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/book")) bookingRequests.push(request.method());
  });

  await page.goto("/book?state=booking-contact-error");

  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  const phone = page.getByRole("textbox", { name: "Phone (optional)", exact: true });

  await expect(email).toHaveValue("alex@");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "bk-email-error");
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(email).toBeFocused();
  await expect(name).toHaveValue("Alex Morgan");
  await expect(phone).toHaveValue("(405) 555-0147");

  await email.fill("alex@example.com");
  await expect(page.getByText("Enter a valid email address.")).toHaveCount(0);
  await expect(name).toHaveValue("Alex Morgan");
  await expect(phone).toHaveValue("(405) 555-0147");

  await page.getByRole("button", { name: "Continue to choose a time", exact: true }).click();
  await expect(page.getByText("STEP 2 / 2")).toBeVisible();
  expect(bookingRequests).toEqual([]);
});
