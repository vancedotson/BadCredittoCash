import { expect, test } from "@playwright/test";

test("public homepage reaches the registration form", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Vance Dotson/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/calls/i);

  // The primary CTA leads to the credit-check lead magnet and the secondary CTA
  // to the live webinar; the registration form stays on the page at #register.
  await expect(page.getByRole("link", { name: /check my credit report, free/i }).first()).toHaveAttribute("href", "/credit-check");
  await expect(page.getByRole("link", { name: /join the live session/i }).first()).toHaveAttribute("href", "/live");

  await page.goto("/#register");
  await expect(page.locator("#register")).toBeInViewport();
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await expect(email).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /phone/i })).toHaveCount(0);

  const submit = page.getByRole("button", { name: /send me the free training/i });
  await expect(submit).toBeVisible();
  await expect(
    page.getByText("Free training. No payment. No obligation. Your link arrives by email."),
  ).toBeVisible();

  await email.focus();
  await expect(email).toBeFocused();
  await expect
    .poll(() => email.evaluate((element) => getComputedStyle(element).boxShadow))
    .not.toBe("none");
  await submit.click();

  await expect(page.getByText("Enter a valid email so we can send your link.")).toBeVisible();
  await expect(page.getByText("Please enter your name.")).toBeVisible();
  await expect(email).toBeFocused();
});

test("registration invalid review state shows the field problems", async ({ page }) => {
  await page.goto("/?state=registration-invalid#register");

  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const name = page.getByRole("textbox", { name: "Name", exact: true });

  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a valid email so we can send your link.")).toBeVisible();
  await expect(page.getByText("Please enter your name.")).toBeVisible();
  await expect(email).toBeFocused();
});

test("registration server error review state keeps information and allows retry", async ({ page }) => {
  await page.goto("/?state=registration-error#register");

  const alert = page.getByRole("alert").filter({ hasText: "We couldn't send your link." });
  await expect(alert).toContainText("We couldn't send your link.");
  await expect(alert).toContainText(
    "Your information is still here. Please try again.",
  );
  await expect(alert).toBeInViewport();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue(
    "alex@example.com",
  );
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Alex");
  await expect(page.getByRole("button", { name: /send me the free training/i })).toBeEnabled();
});

test("registration submitting review state locks the completed form", async ({ page }) => {
  await page.goto("/?state=registration-loading#register");

  const form = page.locator("#register form");
  const status = page.getByRole("status");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  const name = page.getByRole("textbox", { name: "Name", exact: true });

  await expect(form).toHaveAttribute("aria-busy", "true");
  await expect(status).toContainText("Sending your private training link.");
  await expect(status).toContainText("Please wait. Keep this page open.");
  await expect(status).toBeInViewport();
  await expect(email).toHaveValue("alex@example.com");
  await expect(name).toHaveValue("Alex");
  await expect(email).toBeDisabled();
  await expect(name).toBeDisabled();
  await expect(page.getByRole("button", { name: /sending your link/i })).toBeDisabled();
});

test("legal pages and consent links are complete", async ({ page }) => {
  await page.goto("/#register");

  const registration = page.locator("#register form");
  await expect(registration.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  await expect(registration.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");

  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

  await page.goto("/privacy");
  await expect(page).toHaveTitle(/Privacy Policy/i);
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your privacy choices" })).toBeVisible();
  await expect(page.getByText("425 W. Wilshire Blvd Ste E", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/draft|placeholder|waiting for.*lawyer/i)).toHaveCount(0);

  await page.goto("/terms");
  await expect(page).toHaveTitle(/Terms of Service/i);
  await expect(page.getByRole("heading", { level: 1, name: "Terms of Service" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Services and separate agreements" })).toBeVisible();
  await expect(page.getByText(/Results vary and are not guaranteed/i)).toBeVisible();
  await expect(page.getByText(/draft|placeholder|waiting for.*lawyer/i)).toHaveCount(0);
});
