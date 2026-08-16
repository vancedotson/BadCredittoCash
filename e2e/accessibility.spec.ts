import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("registration invalid state has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/?state=registration-invalid#register");
  await expect(page.getByText("Enter a valid email so we can send your link.")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include("#register")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("registration server error has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/?state=registration-error#register");
  await expect(page.getByRole("alert")).toContainText("We couldn't send your link.");

  const results = await new AxeBuilder({ page })
    .include("#register")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("registration submitting state has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/?state=registration-loading#register");
  await expect(page.getByRole("status")).toContainText("Sending your private training link.");

  const results = await new AxeBuilder({ page })
    .include("#register")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("quiz question one has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-1");
  await expect(page.getByText("QUESTION 1 OF 3")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("quiz question two has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-2");
  await expect(page.getByText("QUESTION 2 OF 3")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("quiz question three has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-3");
  await expect(page.getByText("QUESTION 3 OF 3")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("quiz ready state has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-ready");
  await expect(page.getByText("Answer selected. Open the training when ready.")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("quiz loading state has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/confirmed?state=quiz-loading");
  await expect(page.getByRole("status")).toHaveText("Opening your training. Please wait.");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("training room has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("playing player has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room?state=player-playing");
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("player at 25 percent has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room?state=player-25");
  await expect(page.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "25");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("player at 50 percent has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room?state=player-50");
  await expect(page.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "50");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("player at 75 percent has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room?state=player-75");
  await expect(page.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "75");
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("player at 90 percent has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room?state=player-90");
  await expect(page.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "90");
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("completed player has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room?state=player-complete");
  await expect(page.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByText("Training complete")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("booking offer review state has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/room?state=offer-visible");
  await expect(page.getByRole("slider", { name: "Seek" })).toHaveAttribute("aria-valuenow", "70");
  await expect(page.getByText("YOUR NEXT STEP")).toBeVisible();
  await expect(page.getByRole("link", { name: /book my free strategy call/i })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("webinar booking entry has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/call");
  await expect(page.getByRole("button", { name: "Continue to choose a time", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("booking confirmation has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/booked?state=booking-details");
  await expect(page.getByText("Your 30-minute appointment")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("direct booking offer has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/book");
  await expect(page.getByText("Your details", { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("direct booking contact error has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/book?state=booking-contact-error");
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("direct booking loading state has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/book?state=booking-loading");
  await expect(page.locator('form[aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /booking your call/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /booking your call/i })).toBeDisabled();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("booking availability error has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/book?state=booking-availability-error");
  await expect(page.locator("#booking-availability-error")).toContainText(/couldn't load live appointment times/i);
  await expect(page.getByRole("button", { name: "Retry availability", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm my call", exact: true })).toBeDisabled();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("booking slot taken state has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/book?state=booking-error");
  await expect(page.locator("#booking-slot-error")).toContainText(/time was just booked/i);
  await expect(page.getByRole("button", { name: /^9:00 AM/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "11:00 AM", exact: true })).toBeFocused();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("generic booking confirmation has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/webinar/booked?state=booking-generic");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/your call is booked/i);
  await expect(page.getByText("Your 30-minute appointment")).toHaveCount(0);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("direct booking calendar has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/book?state=booking-calendar");
  await expect(page.getByText("STEP 2 / 2")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

for (const loginState of [
  { name: "normal sign in", url: "/login", ready: /local sign-in is unavailable/i },
  { name: "missing-password sign in", url: "/login?state=missing-password", ready: /enter your password/i },
  { name: "invalid-login sign in", url: "/login?state=invalid-login", ready: /email or password is incorrect/i },
  { name: "loading sign in", url: "/login?state=login-loading", ready: /signing in securely/i },
  { name: "expired-session sign in", url: "/login?reason=session-expired", ready: /your session expired/i },
]) {
  test(`${loginState.name} has no serious automated accessibility violations`, async ({ page }) => {
    await page.goto(loginState.url);
    await expect(page.getByText(loginState.ready)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
  });
}

for (const resetState of [
  { name: "normal reset request", url: "/forgot-password", ready: /local password reset is unavailable/i },
  { name: "sent reset request", url: "/forgot-password?state=reset-sent", ready: /sent a secure password-reset link/i },
  { name: "error reset request", url: "/forgot-password?state=reset-error", ready: /could not send the reset email/i },
  { name: "loading reset request", url: "/forgot-password?state=reset-loading", ready: /sending a secure reset link/i },
]) {
  test(`${resetState.name} has no serious automated accessibility violations`, async ({ page }) => {
    await page.goto(resetState.url);
    await expect(page.getByText(resetState.ready)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
  });
}

for (const passwordState of [
  { name: "short new password", url: "/auth/update-password?state=missing-password", ready: "#password-error" },
  { name: "mismatched new password", url: "/auth/update-password?state=password-mismatch", ready: "#password-error" },
  { name: "saving new password", url: "/auth/update-password?state=password-loading", ready: "#password-loading-status" },
  { name: "invalid password link", url: "/auth/update-password?state=invalid-link", ready: "p[role='alert']" },
]) {
  test(`${passwordState.name} has no serious automated accessibility violations`, async ({ page }) => {
    await page.goto(passwordState.url);
    await expect(page.locator(passwordState.ready)).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
  });
}

test("CRM overview has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm");
  await expect(page.getByRole("heading", { name: "Needs attention", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM contacts has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/contacts");
  await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM contact detail has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/contacts");
  await page.getByRole("link", { name: "Ana Martins", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Ana Martins", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM pipeline has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/pipeline");
  await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM tasks has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/tasks");
  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM activity has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/activity");
  await expect(page.getByText("this week", { exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM sequences has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/sequences");
  await expect(page.getByRole("heading", { name: "Sequences", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM calendar has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/calendar");
  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM system health has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/health");
  await expect(page.getByRole("heading", { name: "System health", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});

test("CRM settings has no serious automated accessibility violations", async ({ page }) => {
  await page.goto("/crm/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);
});
