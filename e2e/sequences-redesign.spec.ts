import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SEQUENCES, SEGMENT_SEQUENCES } from "../src/config/sequences";

const unexpectedWrites = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, context, baseURL }) => {
  if (!process.env.E2E_BASE_URL || !baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Sequence checks require an explicit localhost E2E_BASE_URL.");
  }
  const writes: string[] = [];
  unexpectedWrites.set(page, writes);
  // Every action is mocked below. Never enqueue real email or change enrollment.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort("blockedbyclient");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    }
    return route.continue();
  });
  await page.setViewportSize({ width: 1536, height: 1000 });
});

test.afterEach(async ({ page }) => {
  expect(unexpectedWrites.get(page), "All writes must be explicitly mocked").toEqual([]);
});

async function openSequences(page: Page) {
  await page.goto("/crm/sequences");
  await expect(page.getByRole("heading", { level: 1, name: "Sequences", exact: true })).toBeVisible();
}

function queue(page: Page) {
  return page.getByRole("region", { name: "Enrollment queue", exact: true });
}

function failures(page: Page) {
  return page.getByRole("region", { name: "Permanent failures", exact: true });
}

function evanEnrollment(page: Page) {
  return queue(page).locator("[data-enrollment-id]").filter({ has: page.getByRole("link", { name: "Evan Wright", exact: true }) });
}

async function openReference(page: Page, heading: string) {
  const title = page.getByRole("heading", { name: heading, exact: true });
  const details = title.locator("xpath=ancestor::details[1]");
  if (await details.count() && !(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await details.locator(":scope > summary").click();
  }
  await expect(title).toBeVisible();
  return details;
}

test("global queue totals are distinct from the latest enrollments and contact links remain direct", async ({ page }) => {
  await openSequences(page);
  const summary = page.getByRole("region", { name: "Sequence summary", exact: true });
  for (const label of ["Active enrollments", "Scheduled", "Retrying", "Sent", "Failed"]) {
    await expect(summary.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(summary).toContainText("19");
  await expect(queue(page)).toContainText(/12/);
  await expect(queue(page).locator("[data-enrollment-id]")).toHaveCount(12);
  const evan = evanEnrollment(page);
  const contact = evan.getByRole("link", { name: "Evan Wright", exact: true });
  const href = await contact.getAttribute("href");
  expect(href).toMatch(/^\/crm\/contacts\/lead_/);
  await expect(evan).toContainText("evan@example.com");
  await expect(evan).toContainText("1 scheduled");
  await contact.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByRole("heading", { name: "Evan Wright", exact: true })).toBeVisible();
});

test("pause and resume preserve the exact enrollment and only change the selected row", async ({ page }) => {
  const actions: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/sequences", async (route) => {
    actions.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await openSequences(page);
  const evan = evanEnrollment(page);
  const contactId = (await evan.getByRole("link", { name: "Evan Wright", exact: true }).getAttribute("href"))!.split("/").at(-1);
  const enrollmentId = `demo:${contactId}:pre_webinar`;
  const other = queue(page).locator("[data-enrollment-id]").filter({ has: page.getByRole("link", { name: "Rosa Jimenez", exact: true }) });
  const activeTotal = page.getByRole("region", { name: "Sequence summary", exact: true }).getByText("Active enrollments", { exact: true }).locator("..");
  await expect(activeTotal).toContainText("19");
  await evan.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(evan.getByText("Paused", { exact: true })).toBeVisible();
  await expect(activeTotal).toContainText("18");
  await expect(other.getByText("Active", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Sequence paused");
  await evan.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(evan.getByText("Active", { exact: true })).toBeVisible();
  await expect(activeTotal).toContainText("19");
  await expect(page.getByRole("status")).toContainText("Sequence resumed");
  expect(actions).toEqual([{ action: "pause", enrollmentId }, { action: "resume", enrollmentId }]);
});

test("pending and failed enrollment changes do not duplicate requests or lose the row", async ({ page }) => {
  const actions: Array<Record<string, unknown>> = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/crm/sequences", async (route) => {
    actions.push(route.request().postDataJSON());
    await held;
    await route.fulfill({ status: 503, json: { error: "Enrollment service is temporarily unavailable." } });
  });
  await openSequences(page);
  const evan = evanEnrollment(page);
  const pause = evan.getByRole("button", { name: "Pause", exact: true });
  await pause.click();
  try {
    const saving = evan.getByRole("button", { name: "Saving…", exact: true });
    await expect(saving).toBeDisabled();
    await saving.evaluate((element) => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
    await expect.poll(() => actions.length).toBe(1);
    await expect(evan.getByText("Active", { exact: true })).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enrollment service is temporarily unavailable.");
  await expect(evan.getByText("Active", { exact: true })).toBeVisible();
  await expect(pause).toBeEnabled();
  await expect(queue(page).locator("[data-enrollment-id]")).toHaveCount(12);
  await expect(page.getByRole("status").filter({ hasText: "Sequence paused" })).toHaveCount(0);
});

test("email retry requires confirmation, retains failures on error, and submits the exact message once", async ({ page }) => {
  const actions: Array<Record<string, unknown>> = [];
  let reject = true;
  await page.route("**/api/crm/sequences", async (route) => {
    actions.push(route.request().postDataJSON());
    await route.fulfill(reject ? { status: 503, json: { error: "Email provider is still unavailable." } } : { json: { ok: true } });
  });
  await openSequences(page);
  const retry = failures(page).getByRole("button", { name: "Retry email", exact: true });
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toBe("Retry booking_abandon:1 for Sofia Rossi? This queues the email to send again.");
    await dialog.dismiss();
  });
  await retry.click();
  expect(actions).toEqual([]);
  await expect(failures(page).getByRole("link", { name: "Sofia Rossi", exact: true })).toHaveAttribute("href", /^\/crm\/contacts\/lead_/);
  page.once("dialog", (dialog) => dialog.accept());
  await retry.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email provider is still unavailable.");
  await expect(retry).toBeEnabled();
  await expect(failures(page)).toContainText("Provider temporarily rejected the message.");
  await expect(page.getByRole("status").filter({ hasText: "queued for retry" })).toHaveCount(0);
  reject = false;
  page.once("dialog", (dialog) => dialog.accept());
  await retry.click();
  await expect(page.getByRole("status")).toContainText("Failed email queued for retry.");
  await expect(page.getByRole("alert").filter({ hasText: "Email provider is still unavailable." })).toHaveCount(0);
  await expect(retry).toHaveCount(0);
  const summary = page.getByRole("region", { name: "Sequence summary", exact: true });
  await expect(summary.getByText("Scheduled", { exact: true }).locator("..")).toContainText("7");
  await expect(summary.getByText("Failed", { exact: true }).locator("..")).toContainText("0");
  await expect(summary.getByText("Retrying", { exact: true }).locator("..")).toContainText("1");
  expect(actions).toEqual([{ action: "retry", messageId: "demo-failure-1" }, { action: "retry", messageId: "demo-failure-1" }]);
});

test("all nine sequences retain their 24 email bodies, timing, routing, and merge references", async ({ page }) => {
  await openSequences(page);
  await expect(page.getByRole("link", { name: /View live webinars/ })).toHaveAttribute("href", "/crm/webinars");
  const navigation = page.getByRole("navigation", { name: "Sequence sections", exact: true });
  for (const [name, id] of [["Sequence library", "sequence-library"], ["Automation map", "automation-map"], ["Merge fields", "merge-fields"], ["Enrollments", "enrollments"]]) {
    const link = navigation.getByRole("link", { name, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
  await openReference(page, "How it works");
  for (const step of ["Behavior", "Segment", "Enroll", "Schedule", "Send"]) {
    await expect(page.getByText(step, { exact: true }).first()).toBeVisible();
  }
  await openReference(page, "What triggers each sequence");
  await expect(page.getByText("A contact registers", { exact: true })).toBeVisible();
  await expect(page.getByText("A contact books a call", { exact: true })).toBeVisible();
  await openReference(page, "Merge fields");
  const mergeFields = page.getByRole("region", { name: "Merge fields", exact: true });
  await expect(mergeFields.getByText("{{watch_link}}", { exact: true })).toBeVisible();
  await expect(mergeFields.getByText("{{call_link}}", { exact: true })).toBeVisible();

  const sequences = [...Object.values(SEQUENCES), ...Object.values(SEGMENT_SEQUENCES)];
  expect(sequences).toHaveLength(9);
  expect(sequences.reduce((count, sequence) => count + sequence.emails.length, 0)).toBe(24);
  for (const sequence of sequences) {
    const details = await openReference(page, sequence.name);
    await expect(details).toContainText(sequence.trigger);
    for (const email of sequence.emails) {
      await expect(details.getByText(email.subject, { exact: true })).toBeVisible();
      await expect(details).toContainText(email.body);
      await expect(details.getByText(email.delay, { exact: true }).first()).toBeVisible();
    }
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`desktop and 320px mobile are accessible without horizontal overflow in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await openSequences(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    // Disable presentation transitions so axe evaluates the settled palette.
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
    for (const viewport of [{ width: 1536, height: 1000 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(queue(page).getByRole("button", { name: "Pause", exact: true }).first()).toBeVisible();
      await openReference(page, "Pre-webinar (get them to watch)");
      await openReference(page, "What triggers each sequence");
      await openReference(page, "Merge fields");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations, result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`).join("\n")).toEqual([]);
    }
  });
}
