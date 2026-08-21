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

test("CRM shortcut help is visible and matches working shortcuts", async ({ page }) => {
  await page.goto("/crm");

  await page.getByRole("button", { name: "Open account menu", exact: true }).click({ force: true });
  const accountMenu = page.getByRole("menu", { name: "Account", exact: true });
  await expect(accountMenu.getByRole("menuitem", { name: "Sign out", exact: true })).toBeVisible();
  await accountMenu.getByRole("menuitem", { name: "Keyboard shortcuts", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Open search", { exact: true })).toBeVisible();
  for (const destination of ["Overview", "Contacts", "Pipeline", "Tasks", "Calendar", "Activity", "Settings"]) {
    await expect(dialog.getByText(destination, { exact: true })).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.keyboard.press("g");
  await page.keyboard.press("t");
  await expect(page).toHaveURL(/\/crm\/tasks$/);
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true })).toBeVisible();
});

test("CRM shortcut help can be found on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm");

  await page.getByRole("button", { name: "Open CRM menu", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Sign out", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: /Keyboard shortcuts/ }).click();
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true })).toBeVisible();
});

test("CRM overview work queue has ranked direct actions", async ({ page }) => {
  const updates: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/task", async (route) => {
    updates.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/crm?owner=__all__");

  const queue = page.getByRole("region", { name: "Needs attention" });
  await expect(queue.getByText("Most urgent work is shown first.", { exact: true })).toBeVisible();
  await expect(queue.getByRole("button", { name: /^Complete / }).first()).toBeVisible();
  const snooze = queue.getByRole("button", { name: /^Snooze / }).first();
  await expect(snooze).toBeVisible();
  const assign = queue.getByRole("combobox", { name: /^Assign / }).first();
  await expect(assign).toBeVisible();

  await assign.selectOption("Team");
  await expect.poll(() => updates.some((update) => update.owner === "Team")).toBe(true);
  await snooze.click();
  await expect.poll(() => updates.some((update) => typeof update.dueDate === "string")).toBe(true);
  await expect(page.getByRole("status")).toContainText("Task snoozed until tomorrow");
});

test("CRM percentages show their sample and forecast method", async ({ page }) => {
  await page.goto("/crm");
  await expect(page.getByText(/\d+ booked \/ \d+ registered/, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/average across \d+ viewers/, { exact: true })).toBeVisible();
  await expect(page.getByText(/Forecast weights each contact by stage/)).toBeVisible();

  await page.goto("/crm/pipeline");
  await page.getByText("How the forecast works", { exact: true }).click();
  await expect(page.getByText(/Each contact is weighted by stage/)).toBeVisible();
  await expect(page.getByText(/estimate, not a promise/)).toBeVisible();
});

test("CRM overview and tasks default to My work", async ({ page }) => {
  await page.goto("/crm");
  const overviewOwner = page.getByRole("combobox", { name: "Owner", exact: true });
  await expect(overviewOwner).toHaveValue("Vance");
  await expect(overviewOwner.locator("option:checked")).toHaveText("My work (Vance)");
  await overviewOwner.selectOption("__all__");
  await expect(page).toHaveURL(/owner=__all__/);

  await page.goto("/crm/tasks");
  const taskOwner = page.getByRole("combobox", { name: "Owner", exact: true });
  await expect(taskOwner).toHaveValue("Vance");
  await expect(taskOwner.locator("option:checked")).toHaveText("My work (Vance)");
  await taskOwner.selectOption("__all__");
  await expect(taskOwner).toHaveValue("__all__");
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

test("CRM contact rows open a complete contact workspace", async ({ page }) => {
  await page.goto("/crm/contacts");
  await page.getByRole("link", { name: "Ana Martins", exact: true }).first().click();

  await expect(page).toHaveURL(/\/crm\/contacts\/lead_/);
  await expect(page.getByRole("heading", { name: "Ana Martins", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Snapshot", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Privacy & data", exact: true })).toBeVisible();
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

test("CRM pipeline puts deal cards before summary stats on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm/pipeline");

  const board = await page.getByRole("region", { name: "Pipeline board" }).boundingBox();
  const summary = await page.getByRole("region", { name: "Pipeline summary" }).boundingBox();
  expect(board).not.toBeNull();
  expect(summary).not.toBeNull();
  expect(board!.y).toBeLessThan(summary!.y);
});

test("CRM pipeline stage changes can be undone", async ({ page }) => {
  const updates: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact/*", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    updates.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, lead: { updatedAt: new Date().toISOString() } }),
    });
  });
  await page.goto("/crm/pipeline");

  await page.getByLabel("Move Walk-in Referral to another stage").first().selectOption("registered");
  await expect(page.getByRole("status")).toContainText("moved to Registered");
  await page.getByRole("button", { name: "Undo", exact: true }).click();

  await expect.poll(() => updates.length).toBe(2);
  expect(updates[0].stage).toBe("registered");
  expect(updates[1].stage).toBe("new");
});

test("CRM tasks groups work and exposes recurrence and actions", async ({ page }) => {
  await page.goto("/crm/tasks");
  await page.getByRole("combobox", { name: "Owner", exact: true }).selectOption("__all__");

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

test("CRM remembers task and activity filters", async ({ page }) => {
  await page.goto("/crm/tasks");
  await page.evaluate(() => localStorage.removeItem("crm-task-filters"));
  await page.reload();
  await expect(page.locator('[data-filters-ready="true"]')).toBeVisible();
  await page.getByRole("combobox", { name: "Priority", exact: true }).selectOption("high");
  await page.getByRole("button", { name: "By contact", exact: true }).click();
  await expect(page.getByRole("button", { name: "By contact", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("crm-task-filters"))).toContain('"priority":"high"');
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Priority", exact: true })).toHaveValue("high");
  await expect(page.getByRole("button", { name: "By contact", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/crm/activity");
  await page.evaluate(() => localStorage.removeItem("crm-activity-filters"));
  await page.reload();
  await expect(page.locator('[data-filters-ready="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Watch", exact: true }).click();
  await page.getByRole("button", { name: "By contact", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("crm-activity-filters"))).toContain('"category":"watch"');
  await page.reload();
  await expect(page.getByRole("button", { name: "Watch", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "By contact", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("CRM empty filter results offer a reset", async ({ page }) => {
  await page.goto("/crm/tasks");
  await page.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Vance");
  await page.getByRole("combobox", { name: "Priority", exact: true }).selectOption("low");
  await expect(page.getByText("No tasks match these filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Owner", exact: true })).toHaveValue("__all__");

  await page.goto("/crm/activity");
  await page.getByLabel("Search activity", { exact: true }).fill("no-such-activity-987");
  await expect(page.getByText("No activity matches these filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page.getByText(/registered for the training/i).first()).toBeVisible();

  await page.goto("/crm/contacts?q=no-such-contact-987");
  const contactsTable = page.getByRole("table");
  await expect(contactsTable.getByText("No contacts match these filters.", { exact: true })).toBeVisible();
  await contactsTable.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(page).toHaveURL(/\/crm\/contacts$/);
});

test("CRM task completion can be undone", async ({ page }) => {
  const updates: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/task", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    updates.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, task: body }) });
  });
  await page.goto("/crm/tasks");

  await page.getByRole("button", { name: "Mark done", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("Task completed");
  await page.getByRole("button", { name: "Undo", exact: true }).click();

  await expect.poll(() => updates.length).toBe(2);
  expect(updates[0].done).toBe(true);
  expect(updates[1].done).toBe(false);
});

test("CRM activity is filterable and easy to scan", async ({ page }) => {
  await page.goto("/crm/activity");

  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByText("this week", { exact: true })).toBeVisible();
  await expect(page.getByText(/registered for the training/i).first()).toBeVisible();
  await expect(page.getByText("Repeated activity from the same contact on the same day is grouped.", { exact: true })).toBeVisible();
  const groupedWatchItem = page.getByRole("listitem").filter({ hasText: "Training watch progress" }).filter({ hasText: "4 milestones" }).first();
  await expect(groupedWatchItem).toBeVisible();
  await groupedWatchItem.getByRole("button", { name: "details", exact: true }).click();
  await expect(groupedWatchItem.getByText(/Watched 25%/)).toBeVisible();
  await expect(groupedWatchItem.getByText(/Watched 90%/)).toBeVisible();

  await page.getByRole("button", { name: "Engagement", exact: true }).click();
  await expect(page.getByRole("button", { name: "Engagement", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/completed the concern quiz/i).first()).toBeVisible();

  await page.getByRole("button", { name: "By contact", exact: true }).click();
  await expect(page.getByRole("button", { name: "By contact", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Rosa Jimenez", exact: true }).first()).toBeVisible();
});

test("CRM sequences explains operations and email progression", async ({ page }) => {
  const actions: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/sequences", async (route) => {
    actions.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
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
  await expect(page.getByRole("heading", { name: "Enrollment queue", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rosa Jimenez", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("Sequence paused");
  await expect.poll(() => actions.some((action) => action.action === "pause")).toBe(true);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Retry email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("queued for retry");
  await expect.poll(() => actions.some((action) => action.action === "retry")).toBe(true);
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

test("CRM calendar opens Agenda first on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm/calendar");

  await expect(page.getByRole("button", { name: "agenda", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Today forward", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "month", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("CRM appointment rescheduling requires save and offers undo", async ({ page }) => {
  const updates: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/booking", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    updates.push(body);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/crm/calendar");
  await page.getByRole("button", { name: /with 1 booked call/ }).first().click();

  const save = page.getByRole("button", { name: "Save new time", exact: true });
  await expect(save).toBeDisabled();
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
  await page.getByLabel("New appointment time", { exact: true }).fill(future);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole("status")).toContainText("Appointment rescheduled");
  await page.getByRole("button", { name: "Undo", exact: true }).click();

  await expect.poll(() => updates.length).toBe(2);
  expect(updates[0].startsAt).not.toBe(updates[1].startsAt);
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
  await expect(page.getByRole("link", { name: "Review data setup →", exact: true })).toHaveAttribute("href", "/crm/settings#data");
  await expect(page.getByRole("link", { name: "Review email setup →", exact: true })).toHaveAttribute("href", "/crm/settings#sequences");
  await expect(page.getByRole("link", { name: "Open Calendar settings →", exact: true })).toHaveAttribute("href", "/crm/settings#calendar");
  await expect(page.getByRole("heading", { name: "Recent checks", exact: true })).toBeVisible();
  await expect(page.getByText(/current/).last()).toBeVisible();
});

test("CRM settings exposes integrations, notifications, and safe backup tools", async ({ page }) => {
  await page.goto("/crm/settings");

  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  const settingsNav = page.getByRole("navigation", { name: "Settings sections", exact: true });
  for (const group of ["Workspace", "CRM setup", "Preferences", "Security & data"]) {
    await expect(settingsNav.getByText(group, { exact: true })).toBeVisible();
  }
  await expect(settingsNav.getByRole("link", { name: "Business profile", exact: true })).toHaveAttribute("href", "#profile");
  await expect(settingsNav.getByRole("link", { name: "Data", exact: true })).toHaveAttribute("href", "#data");
  await expect(page.getByRole("heading", { name: "Business profile", exact: true })).toBeVisible();
  await expect(page.getByLabel("Brand name", { exact: true })).toHaveValue("Vance Dotson");
  await expect(page.getByRole("switch", { name: "New bookings", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("link", { name: "Connect Google Calendar", exact: true })).toHaveAttribute("href", "/api/integrations/google-calendar/connect");
  await expect(page.getByRole("link", { name: "Download full backup (JSON)", exact: true })).toHaveAttribute("href", "/api/crm/backup");
  await expect(page.getByRole("link", { name: "Export contacts (CSV)", exact: true })).toHaveAttribute("href", "/api/crm/export");
  await expect(page.getByLabel("Choose backup file", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Validate backup", exact: true })).toBeDisabled();
});

test("CRM team access is separate from owner labels and has real controls", async ({ page }) => {
  const actions: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/team", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    actions.push(body);
    const member = body.action === "invite" ? { userId: "invited-test", email: body.email, displayName: body.displayName, role: body.role, status: "invited" } : undefined;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, member }) });
  });
  await page.goto("/crm/settings");

  await expect(page.getByRole("heading", { name: "Login access", exact: true })).toBeVisible();
  await expect(page.getByText("Adding one does not create login access.", { exact: false })).toBeVisible();
  const teamRole = page.getByRole("combobox", { name: "Role for Team", exact: true });
  await teamRole.selectOption("readonly");
  await expect.poll(() => actions.some((action) => action.action === "role" && action.role === "readonly")).toBe(true);

  await page.getByLabel("Invite name", { exact: true }).fill("New Staff");
  await page.getByLabel("Invite email", { exact: true }).fill("new.staff@example.com");
  await page.getByRole("button", { name: "Invite team member", exact: true }).click();
  await expect(page.getByText("New Staff", { exact: true })).toBeVisible();
  await expect(page.getByText("Invited", { exact: true }).last()).toBeVisible();
});

test("CRM settings reports failed saves and keeps the draft", async ({ page }) => {
  await page.route("**/api/crm/settings", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Settings service is temporarily unavailable." }),
    });
  });
  await page.goto("/crm/settings");

  const brandName = page.getByLabel("Brand name", { exact: true });
  await brandName.fill("Vance Dotson draft");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Settings service" })).toContainText("Settings service is temporarily unavailable");
  await expect(brandName).toHaveValue("Vance Dotson draft");
  await expect(page.getByText("Saved ✓", { exact: true })).toHaveCount(0);
});

test("CRM mobile navigation exposes every page through More", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm");

  const mobileNav = page.getByRole("navigation", { name: "CRM pages" });
  for (const pageName of ["Overview", "Contacts", "Pipeline", "Tasks"]) {
    await expect(mobileNav.getByRole("link", { name: pageName, exact: false })).toBeVisible();
  }

  const more = mobileNav.getByRole("button", { name: "More", exact: true });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");

  const menu = page.getByRole("menu", { name: "More CRM pages" });
  for (const pageName of ["Activity", "Calendar", "Sequences", "System health", "Settings"]) {
    await expect(menu.getByRole("menuitem", { name: pageName, exact: true })).toBeVisible();
  }

  await menu.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/crm\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});
