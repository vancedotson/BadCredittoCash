import { expect, test } from "@playwright/test";
import type { LiveWebinarSession, LiveWebinarSessionReport } from "../src/lib/live-webinar-types";

const sessionId = "20000000-0000-4000-8000-000000000001";

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
  await expect(form.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("draft");
  await expect(form.getByRole("checkbox", { name: /Enable session emails/ })).not.toBeChecked();
  await form.getByLabel("Title", { exact: true }).fill("October workshop");
  await form.getByLabel("Session URL name").fill("october-workshop");
  await form.getByLabel("Timezone", { exact: true }).fill("America/New_York");
  await form.getByLabel("Starts at").fill("2026-10-08T12:00");
  await form.getByLabel("Ends at").fill("2026-10-08T13:00");
  await form.getByRole("button", { name: "Create session", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Session saved." })).toBeVisible();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ status: "draft", automationEnabled: false, startsAt: "2026-10-08T16:00:00.000Z" });
  await page.getByRole("button", { name: "Edit session", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit live webinar" });
  await expect(edit.getByLabel("Session URL name")).toBeDisabled();
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
  await form.getByLabel("Session URL name").fill("duplicate-workshop");
  await form.getByLabel("Starts at").fill("2026-10-08T12:00");
  await form.getByLabel("Ends at").fill("2026-10-08T13:00");
  await form.getByRole("button", { name: "Create session", exact: true }).click();
  await expect(form.getByRole("alert")).toHaveText("That session slug is already in use.");
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue("Keep this workshop");
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
  await page.getByRole("button", { name: "+ New session", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create session", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/crm/contacts");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByRole("combobox", { name: "Funnel", exact: true }).selectOption("live");
  await expect(page).toHaveURL(/funnel=live/);
  await expect(page.getByRole("combobox", { name: "Source", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Session", exact: true })).toBeVisible();
});
