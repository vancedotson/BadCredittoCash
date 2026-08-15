import { expect, test } from "@playwright/test";

test("CRM overview shows its decision dashboard", async ({ page }) => {
  await page.goto("/crm");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/good (morning|afternoon|evening)/i);
  await expect(page.getByRole("heading", { name: "Needs attention", exact: true })).toBeVisible();
  await expect(page.getByText("Total contacts", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Funnel", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Engagement", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity", exact: true })).toBeVisible();
});

test("CRM contacts supports finding, filtering, and import review", async ({ page }) => {
  await page.goto("/crm/contacts");

  await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();
  await expect(page.getByText("17 contacts", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Export all CSV", exact: true })).toHaveAttribute("href", /\/api\/crm\/export/);

  const search = page.getByRole("textbox", { name: "Search", exact: true });
  await search.fill("Ana Martins");
  await search.press("Enter");
  await expect(page).toHaveURL(/q=Ana\+Martins/);
  await expect(page.getByText("1 matching", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana Martins", exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import contacts (CSV)", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Choose CSV file")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("CRM pipeline makes stages and lost reasons clear", async ({ page }) => {
  await page.goto("/crm/pipeline");

  await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByText("Active pipeline", { exact: true })).toBeVisible();
  await expect(page.getByText("Time in stage", { exact: true })).toBeVisible();
  await expect(page.getByText("Call booked", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Move Walk-in Referral to another stage").first().selectOption("lost");
  const dialog = page.getByRole("dialog", { name: "Why lost?", exact: true });
  await expect(dialog).toContainText(/marking this contact as lost/i);
  await expect(dialog.getByRole("button", { name: "Mark lost", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Not ready yet", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Mark lost", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("CRM tasks groups work and exposes recurrence and actions", async ({ page }) => {
  await page.goto("/crm/tasks");

  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();
  for (const group of ["Overdue", "Due today", "Upcoming", "Done"]) {
    await expect(page.getByRole("heading", { name: group, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/weekly/i).first()).toBeVisible();

  await page.getByRole("button", { name: "By contact", exact: true }).click();
  await expect(page.getByRole("link", { name: "Ana Martins", exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "+ Add task", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add task", exact: true });
  await expect(dialog.getByLabel("Task title")).toBeVisible();
  await expect(dialog.getByLabel("Recurrence")).toContainText("Weekly");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: /actions for draft dispute letters/i }).click();
  await expect(page.getByRole("button", { name: /snooze.*next week/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
});

test("CRM activity is filterable and easy to scan", async ({ page }) => {
  await page.goto("/crm/activity");

  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByText("this week", { exact: true })).toBeVisible();
  await expect(page.getByText(/registered for the training/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Engagement", exact: true }).click();
  await expect(page.getByRole("button", { name: "Engagement", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/completed the concern quiz/i).first()).toBeVisible();

  await page.getByRole("button", { name: "By contact", exact: true }).click();
  await expect(page.getByRole("button", { name: "By contact", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Rosa Jimenez", exact: true }).first()).toBeVisible();
});

test("CRM sequences explains operations and email progression", async ({ page }) => {
  await page.goto("/crm/sequences");

  await expect(page.getByRole("heading", { name: "Sequences", exact: true })).toBeVisible();
  await expect(page.getByText("Active enrollments", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it works", exact: true })).toBeVisible();
  await expect(page.getByText("Behavior", { exact: true })).toBeVisible();
  await expect(page.getByText("Send", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What triggers each sequence", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Merge fields", exact: true })).toBeVisible();
  await expect(page.getByText("{{watch_link}}", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pre-webinar (get them to watch)", exact: true })).toBeVisible();
  await expect(page.getByText("Your training is ready. Here's the link.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Started booking, didn't finish", exact: true })).toBeVisible();
});

test("CRM calendar shows booked calls and switches views", async ({ page }) => {
  await page.goto("/crm/calendar");

  await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
  await expect(page.getByText("3 bookings", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming (7 days)", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent bookings", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ana Martins", exact: true })).toBeVisible();

  const month = page.getByRole("button", { name: "month", exact: true });
  const week = page.getByRole("button", { name: "week", exact: true });
  const agenda = page.getByRole("button", { name: "agenda", exact: true });
  await expect(month).toHaveAttribute("aria-pressed", "true");
  await week.click();
  await expect(week).toHaveAttribute("aria-pressed", "true");
  await agenda.click();
  await expect(agenda).toHaveAttribute("aria-pressed", "true");
});

test("CRM system health makes service problems actionable", async ({ page }) => {
  await page.goto("/crm/health");

  await expect(page.getByRole("heading", { name: "System health", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Some services need attention.", exact: true })).toBeVisible();
  await expect(page.getByText("Database", { exact: true })).toBeVisible();
  await expect(page.getByText("Email provider", { exact: true })).toBeVisible();
  await expect(page.getByText("Email queue", { exact: true })).toBeVisible();
  await expect(page.getByText("Google Calendar", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText(/add the api key before sending real email/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Run checks again", exact: true })).toHaveAttribute("href", "/crm/health");
});

test("CRM settings exposes integrations, notifications, and safe backup tools", async ({ page }) => {
  await page.goto("/crm/settings");

  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business profile", exact: true })).toBeVisible();
  await expect(page.getByLabel("Brand name", { exact: true })).toHaveValue("Vance Dotson");
  await expect(page.getByRole("switch", { name: "New bookings", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("link", { name: "Connect Google Calendar", exact: true })).toHaveAttribute("href", "/api/integrations/google-calendar/connect");
  await expect(page.getByRole("link", { name: "Download full backup (JSON)", exact: true })).toHaveAttribute("href", "/api/crm/backup");
  await expect(page.getByRole("link", { name: "Export contacts (CSV)", exact: true })).toHaveAttribute("href", "/api/crm/export");
  await expect(page.getByLabel("Choose backup file", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Validate backup", exact: true })).toBeDisabled();
});
