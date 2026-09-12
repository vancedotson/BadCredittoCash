import { expect, test, type Page } from "@playwright/test";
import type { LiveWebinarSession, LiveWebinarSessionReport } from "../src/lib/live-webinar-types";

const sessionId = "20000000-0000-4000-8000-000000000001";

async function calendarToday(page: Page) {
  const workspace = page.getByTestId("webinar-workspace");
  await expect(workspace).toHaveAttribute("data-today", /^\d{4}-\d{2}-\d{2}$/);
  return (await workspace.getAttribute("data-today"))!;
}

function calendarDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function calendarMonthLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

test("CRM calendar navigates across years and Today returns to the current month", async ({ page }) => {
  await page.goto("/crm/webinars");
  const today = await calendarToday(page);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  await expect(page.getByRole("button", { name: "Calendar", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: calendarMonthLabel(today), exact: true })).toBeVisible();
  for (let step = month; step < 12; step++) await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page.getByRole("heading", { name: `December ${year}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(page.getByRole("heading", { name: `January ${year + 1}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous month", exact: true }).click();
  await expect(page.getByRole("heading", { name: `December ${year}`, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: calendarMonthLabel(today), exact: true })).toBeVisible();
});

test("CRM calendar date prefills a draft and discarding never saves it", async ({ page }) => {
  const writes: unknown[] = [];
  await page.route("**/api/crm/live-webinars**", (route) => {
    if (route.request().method() === "POST") writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: "Unexpected request in a discarded draft." } });
  });
  await page.goto("/crm/webinars");
  const date = `${(await calendarToday(page)).slice(0, 7)}-24`;
  await page.getByRole("button", { name: `Create session on ${calendarDateLabel(date)}`, exact: true }).click();
  const form = page.getByRole("form", { name: "Create live webinar" });
  await expect(form.getByLabel("Starts at")).toHaveValue(`${date}T12:00`);
  await expect(form.getByLabel("Ends at")).toHaveValue(`${date}T13:00`);
  await expect(form.getByLabel("Timezone", { exact: true })).toHaveValue("America/Chicago");
  await expect(form.getByRole("button", { name: "Stream & delivery", exact: true })).toHaveAttribute("aria-expanded", "false");
  await form.getByRole("button", { name: "Stream & delivery", exact: true }).click();
  await expect(form.getByRole("checkbox", { name: /Enable session emails/ })).not.toBeChecked();
  await form.getByLabel("Title", { exact: true }).fill("Discard this draft");
  await form.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue("");
  await form.getByRole("button", { name: "Discard changes", exact: true }).click();
  expect(writes).toEqual([]);
});

test("CRM calendar and monthly sessions list select the correct saved report", async ({ page }) => {
  const saved: LiveWebinarSession[] = [];
  const reportRequests: string[] = [];
  await page.route("**/api/crm/live-webinars**", async (route) => {
    if (route.request().method() === "POST") {
      const data = route.request().postDataJSON().session;
      const session = { ...data, id: `20000000-0000-4000-8000-${String(saved.length + 1).padStart(12, "0")}`, scheduleVersion: 1 } as LiveWebinarSession;
      saved.push(session);
      await route.fulfill({ json: { session } });
      return;
    }
    const id = new URL(route.request().url()).searchParams.get("sessionId")!;
    reportRequests.push(id);
    const report: LiveWebinarSessionReport = { session: saved.find((session) => session.id === id)!, registrations: [], stats: { registrations: 0, attended: 0, noAttendance: 0, replayOpened: 0, booked: 0 } };
    await route.fulfill({ json: report });
  });
  await page.goto("/crm/webinars");
  const month = (await calendarToday(page)).slice(0, 7);
  for (const [index, title] of ["First calendar workshop", "Second calendar workshop"].entries()) {
    const date = `${month}-${24 + index}`;
    await page.getByRole("button", { name: `Create session on ${calendarDateLabel(date)}`, exact: true }).click();
    const form = page.getByRole("form", { name: "Create live webinar" });
    await form.getByLabel("Title", { exact: true }).fill(title);
    await form.getByRole("button", { name: "Edit session URL name", exact: true }).click();
    await form.getByLabel("Session URL name").fill(`calendar-workshop-${index + 1}`);
    await form.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(form).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Registrations for this session", exact: true })).toBeVisible();
  }
  const calendar = page.getByRole("region", { name: "Webinar calendar", exact: true });
  await calendar.getByRole("button", { name: "Sessions", exact: true }).click();
  await expect(calendar.getByRole("button", { name: "Sessions", exact: true })).toHaveAttribute("aria-pressed", "true");
  await calendar.getByRole("button", { name: /First calendar workshop/ }).click();
  await expect.poll(() => reportRequests.at(-1)).toBe(saved[0].id);
  await expect(page).toHaveURL(new RegExp(`sessionId=${saved[0].id}`));
  await expect(calendar.getByRole("button", { name: /First calendar workshop/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Edit session", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit live webinar" });
  await expect(edit.getByLabel("Title", { exact: true })).toHaveValue("First calendar workshop");
  await edit.getByRole("button", { name: "Discard changes", exact: true }).click();
  await calendar.getByRole("button", { name: "Next month", exact: true }).click();
  await expect(calendar.getByRole("button", { name: /calendar workshop/ })).toHaveCount(0);
  await expect(calendar.getByText(/^No sessions in /)).toBeVisible();
  await calendar.getByRole("button", { name: "Previous month", exact: true }).click();
  await calendar.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(calendar.getByRole("button", { name: "Calendar", exact: true })).toHaveAttribute("aria-pressed", "true");
  await calendar.getByRole("button", { name: /Second calendar workshop/ }).click();
  await expect.poll(() => reportRequests.at(-1)).toBe(saved[1].id);
  await expect(page).toHaveURL(new RegExp(`sessionId=${saved[1].id}`));
  await expect(calendar.getByRole("button", { name: /Second calendar workshop/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Edit session", exact: true }).click();
  await expect(edit.getByLabel("Title", { exact: true })).toHaveValue("Second calendar workshop");
});

test("CRM creates a disabled draft and edits the same session when postponed", async ({ page }) => {
  let saved: LiveWebinarSession | null = null;
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/live-webinars**", async (route) => {
    if (route.request().method() === "POST") {
      const data = route.request().postDataJSON().session;
      writes.push(data);
      saved = { ...data, id: data.id ?? sessionId, scheduleVersion: writes.length } as LiveWebinarSession;
      await route.fulfill({ json: { session: saved } });
      return;
    }
    const report: LiveWebinarSessionReport = { session: saved!, registrations: [], stats: { registrations: 0, attended: 0, noAttendance: 0, replayOpened: 0, booked: 0 } };
    await route.fulfill({ json: report });
  });
  await page.goto("/crm/webinars");
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  const form = page.getByRole("form", { name: "Create live webinar" });
  await form.getByRole("button", { name: "Stream & delivery", exact: true }).click();
  await expect(form.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("draft");
  await expect(form.getByRole("checkbox", { name: /Enable session emails/ })).not.toBeChecked();
  await form.getByLabel("Title", { exact: true }).fill("October workshop");
  await form.getByRole("button", { name: "Edit session URL name", exact: true }).click();
  await form.getByLabel("Session URL name").fill("october-workshop");
  await form.getByLabel("Timezone", { exact: true }).fill("America/New_York");
  await form.getByLabel("Starts at").fill("2026-10-08T12:00");
  await form.getByLabel("Ends at").fill("2026-10-08T13:00");
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Session saved." })).toBeVisible();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ status: "draft", automationEnabled: false, startsAt: "2026-10-08T16:00:00.000Z" });
  await page.getByRole("button", { name: "Edit session", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit live webinar" });
  await expect(edit.getByLabel("Session URL name")).toBeDisabled();
  await expect(edit.getByRole("button", { name: "Edit session URL name", exact: true })).toHaveCount(0);
  await edit.getByRole("button", { name: "Stream & delivery", exact: true }).click();
  await edit.getByRole("combobox", { name: "Status", exact: true }).selectOption("scheduled");
  await edit.getByLabel("Starts at").fill("2026-10-15T12:00");
  await edit.getByLabel("Ends at").fill("2026-10-15T13:00");
  await edit.getByLabel("Live player URL").fill("https://www.youtube.com/embed/test");
  await edit.getByRole("button", { name: "Save session", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toMatchObject({ id: sessionId, status: "scheduled", automationEnabled: false, startsAt: "2026-10-15T16:00:00.000Z" });
  await expect(page.getByRole("heading", { name: "Registrations for this session" })).toBeVisible();
});

test("CRM keeps draft values when saving fails", async ({ page }) => {
  await page.route("**/api/crm/live-webinars", (route) => route.fulfill({ status: 409, json: { error: "That session slug is already in use." } }));
  await page.goto("/crm/webinars");
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  const form = page.getByRole("form", { name: "Create live webinar" });
  await form.getByLabel("Title", { exact: true }).fill("Keep this workshop");
  await form.getByRole("button", { name: "Edit session URL name", exact: true }).click();
  await form.getByLabel("Session URL name").fill("duplicate-workshop");
  await form.getByLabel("Starts at").fill("2026-10-08T12:00");
  await form.getByLabel("Ends at").fill("2026-10-08T13:00");
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(form.getByRole("alert")).toHaveText("That session slug is already in use.");
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue("Keep this workshop");
});

test("CRM suggests a dated session URL and preserves a manual override", async ({ page }) => {
  await page.goto("/crm/webinars");
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  const form = page.getByRole("form", { name: "Create live webinar" });
  const slug = form.getByLabel("Session URL name", { exact: true });
  await expect(slug).toHaveAttribute("readonly", "");
  await form.getByLabel("Title", { exact: true }).fill("Credit & Cash Workshop");
  await form.getByLabel("Starts at").fill("2026-10-08T12:00");
  await expect(slug).toHaveValue("credit-cash-workshop-2026-10-08");
  await form.getByLabel("Starts at").fill("2026-10-15T12:00");
  await expect(slug).toHaveValue("credit-cash-workshop-2026-10-15");
  await form.getByRole("button", { name: "Edit session URL name", exact: true }).click();
  await expect(slug).toBeEditable();
  await slug.fill("my-workshop-link");
  await form.getByLabel("Title", { exact: true }).fill("Updated workshop title");
  await form.getByLabel("Starts at").fill("2026-10-22T12:00");
  await expect(slug).toHaveValue("my-workshop-link");
});

test("CRM title-only edits preserve scheduled delivery and replay settings while collapsed", async ({ page }) => {
  let saved: LiveWebinarSession | null = null;
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/live-webinars**", async (route) => {
    if (route.request().method() === "POST") {
      const data = route.request().postDataJSON().session;
      writes.push(data);
      saved = { ...data, id: data.id ?? sessionId, scheduleVersion: writes.length } as LiveWebinarSession;
      await route.fulfill({ json: { session: saved } });
      return;
    }
    const report: LiveWebinarSessionReport = { session: saved!, registrations: [], stats: { registrations: 0, attended: 0, noAttendance: 0, replayOpened: 0, booked: 0 } };
    await route.fulfill({ json: report });
  });
  await page.goto("/crm/webinars");
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  const form = page.getByRole("form", { name: "Create live webinar" });
  await form.getByLabel("Title", { exact: true }).fill("Scheduled workshop");
  await form.getByLabel("Starts at").fill("2026-10-08T12:00");
  await form.getByLabel("Ends at").fill("2026-10-08T13:00");
  await form.getByRole("button", { name: "Stream & delivery", exact: true }).click();
  await form.getByRole("combobox", { name: "Status", exact: true }).selectOption("scheduled");
  await form.getByLabel("Live player URL", { exact: true }).fill("https://www.youtube.com/embed/workshop");
  await form.getByRole("checkbox", { name: /Enable session emails/ }).check();
  await form.getByRole("button", { name: "Replay settings", exact: true }).click();
  await form.getByLabel("Replay player URL", { exact: true }).fill("https://player.vimeo.com/video/123456");
  await form.getByLabel("Available until", { exact: false }).fill("2026-10-15T13:00");
  await form.getByRole("checkbox", { name: "Publish replay", exact: true }).check();
  await form.getByRole("button", { name: "Create scheduled session", exact: true }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole("button", { name: "Edit session", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit live webinar" });
  await expect(edit.getByRole("button", { name: "Stream & delivery", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(edit.getByRole("button", { name: "Replay settings", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(edit.getByRole("combobox", { name: "Status", exact: true })).not.toBeVisible();
  await expect(edit.getByLabel("Replay player URL", { exact: true })).not.toBeVisible();
  await edit.getByLabel("Title", { exact: true }).fill("Revised scheduled workshop");
  await edit.getByRole("button", { name: "Save session", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0]).toMatchObject({ status: "scheduled", automationEnabled: true, replayPublished: true });
  expect(writes[1]).toEqual({ ...writes[0], id: sessionId, title: "Revised scheduled workshop" });
});

for (const [section, field] of [["Stream & delivery", "Live player URL"], ["Replay settings", "Replay player URL"]]) {
  test(`CRM reveals and focuses an invalid ${field.toLowerCase()} after its section is collapsed`, async ({ page }) => {
    const writes: unknown[] = [];
    await page.route("**/api/crm/live-webinars**", (route) => {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ status: 503, json: { error: "Validation should prevent this request." } });
    });
    await page.goto("/crm/webinars");
    await page.getByRole("button", { name: "+ New session", exact: true }).click();
    const form = page.getByRole("form", { name: "Create live webinar" });
    await form.getByLabel("Title", { exact: true }).fill("Invalid player workshop");
    await form.getByLabel("Starts at").fill("2026-10-08T12:00");
    await form.getByLabel("Ends at").fill("2026-10-08T13:00");
    const toggle = form.getByRole("button", { name: section, exact: true });
    await toggle.click();
    await form.getByLabel(field, { exact: true }).fill("https://example.test/unsupported-player");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await form.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(form.getByLabel(field, { exact: true })).toBeFocused();
    await expect(form.getByRole("alert")).toContainText("YouTube");
    expect(writes).toEqual([]);
  });
}

test("CRM modal focuses the title and returns keyboard focus when dismissed", async ({ page }) => {
  await page.goto("/crm/webinars");
  const trigger = page.getByRole("button", { name: "+ New session", exact: true });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const form = page.getByRole("form", { name: "Create live webinar" });
  await expect(form.getByLabel("Title", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(form).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("CRM prevents duplicate saves and dismissal while a session save is pending", async ({ page }) => {
  const writes: unknown[] = [];
  let releaseSave!: () => void;
  const saveReady = new Promise<void>((resolve) => { releaseSave = resolve; });
  await page.route("**/api/crm/live-webinars**", async (route) => {
    writes.push(route.request().postDataJSON());
    await saveReady;
    await route.fulfill({ status: 503, json: { error: "Temporary save failure." } });
  });
  await page.goto("/crm/webinars");
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  const form = page.getByRole("form", { name: "Create live webinar" });
  await form.getByLabel("Title", { exact: true }).fill("One request workshop");
  await form.getByLabel("Starts at").fill("2026-10-08T12:00");
  await form.getByLabel("Ends at").fill("2026-10-08T13:00");
  try {
    await form.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    await expect(form.locator('button[type="submit"]')).toBeDisabled();
    await expect(form.getByRole("button", { name: "Discard changes", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Close session editor", exact: true })).toBeDisabled();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(form).toBeVisible();
    expect(writes).toHaveLength(1);
  } finally {
    releaseSave();
  }
  await expect(form.getByRole("alert")).toHaveText("Temporary save failure.");
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue("One request workshop");
  await expect(form.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
});

test("CRM rejects an ambiguous daylight-saving time without losing the draft", async ({ page }) => {
  const writes: unknown[] = [];
  await page.route("**/api/crm/live-webinars**", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: "Validation should prevent this request." } });
  });
  await page.goto("/crm/webinars");
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  const form = page.getByRole("form", { name: "Create live webinar" });
  await form.getByLabel("Title", { exact: true }).fill("Clock change workshop");
  await form.getByLabel("Timezone", { exact: true }).fill("America/New_York");
  await form.getByLabel("Starts at").fill("2026-11-01T01:30");
  await form.getByLabel("Ends at").fill("2026-11-01T03:00");
  await form.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("occurs twice");
  await expect(form.getByLabel("Starts at")).toBeFocused();
  await expect(form.getByLabel("Starts at")).toHaveValue("2026-11-01T01:30");
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue("Clock change workshop");
  expect(writes).toEqual([]);
});

test("CRM activity shows every question and keeps repeat sessions separate", async ({ page }) => {
  const requests: string[] = [];
  const items = [
    { id: "q1", event: "live_question_asked", email: "qa@example.test", contactId: "person", contactName: "QA contact", createdAt: "2026-09-12T12:01:00Z", props: { funnel: "live", sessionId, sessionTitle: "First workshop", question: "<script>window.questionExecuted=true</script> My first question" } },
    { id: "q2", event: "live_question_asked", email: "qa@example.test", contactId: "person", contactName: "QA contact", createdAt: "2026-09-12T12:02:00Z", props: { funnel: "live", sessionId, sessionTitle: "First workshop", question: "My second question\nWith extra context" } },
    { id: "q3", event: "live_question_asked", email: "qa@example.test", contactId: "person", contactName: "QA contact", createdAt: "2026-09-12T12:03:00Z", props: { funnel: "live", sessionId: "20000000-0000-4000-8000-000000000002", sessionTitle: "Second workshop", question: "Question in another session" } },
  ];
  await page.route("**/api/crm/activity?**", (route) => { requests.push(route.request().url()); return route.fulfill({ json: { items, total: 3, summary: null } }); });
  await page.goto("/crm/activity");
  await expect(page.getByRole("button", { name: "details", exact: true })).toHaveCount(2);
  while (await page.getByRole("button", { name: "details", exact: true }).count()) await page.getByRole("button", { name: "details", exact: true }).first().click();
  await expect(page.getByText("My second question\nWith extra context", { exact: true })).toBeVisible();
  await expect(page.getByText("Question in another session", { exact: true })).toBeVisible();
  await expect(page.getByText("Session: First workshop", { exact: true })).toBeVisible();
  await expect(page.getByText("Session: Second workshop", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => "questionExecuted" in window)).toBe(false);
  await page.getByRole("combobox", { name: "Funnel", exact: true }).selectOption("live");
  await expect.poll(() => requests.some((url) => url.includes("funnel=live"))).toBe(true);
});

test("CRM mobile session editor and contact funnel filter stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/crm/webinars");
  const date = `${(await calendarToday(page)).slice(0, 7)}-24`;
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const dateButton = page.getByRole("button", { name: `Create session on ${calendarDateLabel(date)}`, exact: true });
  await expect(dateButton).toBeEnabled();
  await dateButton.focus();
  await expect(dateButton).toBeFocused();
  await page.keyboard.press("Enter");
  const form = page.getByRole("form", { name: "Create live webinar" });
  await expect(form.getByRole("button", { name: "Save draft", exact: true })).toBeVisible();
  await expect(form.getByLabel("Starts at")).toHaveValue(`${date}T12:00`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await form.getByRole("button", { name: "Discard changes", exact: true }).click();
  await page.goto("/crm/contacts");
  // The legacy contacts toolbar renders before its client handlers attach.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("combobox", { name: "Funnel", exact: true }).selectOption("live");
  await expect(page).toHaveURL(/funnel=live/);
  await expect(page.getByRole("combobox", { name: "Source", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Session", exact: true })).toBeVisible();
});
