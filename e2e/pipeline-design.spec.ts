import { expect, test, type Page } from "@playwright/test";

const unexpectedMutations = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, baseURL }) => {
  if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
    throw new Error("Pipeline checks require an explicit localhost E2E_BASE_URL.");
  }
  const requests: string[] = [];
  unexpectedMutations.set(page, requests);
  // Every write is mocked below. This fallback prevents a changed request URL
  // from silently modifying the local demo store or any connected CRM data.
  await page.route("**/api/crm/**", async (route) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      requests.push(`${route.request().method()} ${route.request().url()}`);
      await route.fulfill({ status: 503, json: { error: "Unexpected unmocked test mutation." } });
    } else await route.continue();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test.afterEach(async ({ page }) => {
  expect(unexpectedMutations.get(page), "No CRM mutation may reach an unmocked endpoint").toEqual([]);
});

async function openPipeline(page: Page) {
  await page.goto("/crm/pipeline");
  await expect(page.getByRole("heading", { level: 1, name: "Pipeline", exact: true })).toBeVisible();
  await expect(card(page, "Walk-in Referral")).toBeVisible();
}

function card(page: Page, name: string) {
  return page.locator("article[data-pipeline-contact]")
    .filter({ has: page.getByRole("link", { name, exact: true }), visible: true });
}

function column(page: Page, stage: string) {
  return page.locator(`[data-pipeline-stage="${stage}"]`).filter({ visible: true });
}

function stageSelect(page: Page, name: string) {
  return card(page, name).getByRole("combobox", { name: `Move ${name} to another stage`, exact: true });
}

type ContactWrite = { id: string; body: Record<string, unknown> };
const savedAt = "2026-09-12T22:00:00.000Z";

async function mockContactWrites(page: Page) {
  const writes: ContactWrite[] = [];
  await page.route("**/api/crm/contact/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    writes.push({ id: new URL(route.request().url()).pathname.split("/").at(-1)!, body: route.request().postDataJSON() });
    await route.fulfill({ status: 200, json: { ok: true, lead: { updatedAt: savedAt } } });
  });
  return writes;
}

test("search, owner, and source filters change the board while the summary stays global", async ({ page }) => {
  await openPipeline(page);
  const summary = page.getByRole("region", { name: "Pipeline summary", exact: true });
  const initialSummary = await summary.innerText();
  for (const label of ["Active pipeline", "Booked (7 days)", "Win rate", "Forecast", "Clients", "Lost", "Time in stage"]) {
    await expect(summary.getByText(label, { exact: true })).toBeVisible();
  }
  await summary.getByText("How the forecast works", { exact: true }).click();
  await expect(summary).toContainText("New 5%, Registered 15%, Engaged 35%, Call booked 65%, Client 100%, Lost 0%");
  await summary.getByText("How the forecast works", { exact: true }).click();

  const search = page.getByRole("textbox", { name: "Search pipeline", exact: true });
  await search.fill("EVAN@EXAMPLE.COM");
  await expect(page.locator("article[data-pipeline-contact]").filter({ visible: true })).toHaveCount(1);
  await expect(card(page, "Evan Wright")).toBeVisible();
  expect(await summary.innerText()).toBe(initialSummary);
  await search.fill("");
  await page.getByRole("combobox", { name: "Filter by owner", exact: true }).selectOption("Vance");
  await expect(card(page, "Grace Okafor")).toBeVisible();
  await expect(card(page, "Evan Wright")).toHaveCount(0);
  expect(await summary.innerText()).toBe(initialSummary);
  await page.getByRole("combobox", { name: "Filter by source", exact: true }).selectOption("facebook");
  await expect(card(page, "Ana Martins")).toBeVisible();
  await expect(card(page, "Grace Okafor")).toHaveCount(0);
  expect(await summary.innerText()).toBe(initialSummary);
  await page.getByRole("combobox", { name: "Filter by owner", exact: true }).selectOption("__none__");
  await expect(card(page, "Ana Martins")).toHaveCount(0);
  await expect(card(page, "Rosa Jimenez")).toBeVisible();
  await search.fill("no-contact-matches-this-search");
  await expect(page.locator("article[data-pipeline-contact]").filter({ visible: true })).toHaveCount(0);
  expect(await summary.innerText()).toBe(initialSummary);
});

test("all six stages remain available, with existing sorting, collapse, and horizontal navigation", async ({ page }) => {
  await openPipeline(page);
  const sort = page.getByRole("combobox", { name: "Sort", exact: true });
  for (const stage of ["new", "registered", "engaged", "booked", "won", "lost"]) {
    await expect(column(page, stage)).toHaveCount(1);
  }
  const registeredNames = column(page, "registered").locator("article a");
  await expect(registeredNames).toHaveText(["Evan Wright", "Bella Nguyen", "Liam Walsh"]);
  await sort.selectOption("name");
  await expect(registeredNames).toHaveText(["Bella Nguyen", "Evan Wright", "Liam Walsh"]);
  await sort.selectOption("stale");
  await expect(registeredNames).toHaveText(["Liam Walsh", "Bella Nguyen", "Evan Wright"]);
  await sort.selectOption("recent");
  await expect(registeredNames).toHaveText(["Evan Wright", "Bella Nguyen", "Liam Walsh"]);

  await page.getByRole("button", { name: "Collapse Registered", exact: true }).click();
  await expect(card(page, "Evan Wright")).toHaveCount(0);
  await page.getByRole("button", { name: "Expand Registered", exact: true }).click();
  await expect(card(page, "Evan Wright")).toBeVisible();
  const left = page.getByRole("button", { name: "Scroll left", exact: true });
  const right = page.getByRole("button", { name: "Scroll right", exact: true });
  await expect(left).toBeDisabled();
  await right.click();
  await expect(left).toBeEnabled();
  await left.click();
  await expect(left).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a stage dropdown requires a Lost reason and Undo restores the previous stage with the saved version", async ({ page }) => {
  const writes = await mockContactWrites(page);
  await openPipeline(page);
  await stageSelect(page, "Walk-in Referral").selectOption("lost");
  const dialog = page.getByRole("dialog", { name: "Why lost?", exact: true });
  await expect(dialog.getByRole("button", { name: "Mark lost", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(writes).toHaveLength(0);
  await expect(stageSelect(page, "Walk-in Referral")).toHaveValue("new");
  await stageSelect(page, "Walk-in Referral").selectOption("lost");
  await dialog.getByRole("button", { name: "Not ready yet", exact: true }).click();
  await dialog.getByRole("button", { name: "Mark lost", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("1 contact moved to Lost.");
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ stage: "lost", lostReason: "Not ready yet", expectedUpdatedAt: expect.any(String) });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toEqual({ id: writes[0].id, body: { stage: "new", lostReason: "", expectedUpdatedAt: savedAt } });
  await expect(stageSelect(page, "Walk-in Referral")).toHaveValue("new");
});

test("selected contacts can move together, clear selection, and undo independently to their original stages", async ({ page }) => {
  const writes = await mockContactWrites(page);
  await openPipeline(page);
  await card(page, "Walk-in Referral").getByRole("checkbox").check();
  await card(page, "Evan Wright").getByRole("checkbox").check();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("2 selected", { exact: true })).toHaveCount(0);
  await expect(card(page, "Evan Wright").getByRole("checkbox")).not.toBeChecked();
  await card(page, "Walk-in Referral").getByRole("checkbox").check();
  await card(page, "Evan Wright").getByRole("checkbox").check();
  await page.getByRole("combobox", { name: "Move to", exact: true }).selectOption("engaged");
  await expect(page.getByRole("status")).toContainText("2 contacts moved to Engaged.");
  expect(writes).toHaveLength(2);
  for (const write of writes) expect(write.body).toEqual({ stage: "engaged", expectedUpdatedAt: expect.any(String) });
  await expect(page.getByText("2 selected", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => writes.length).toBe(4);
  expect(writes.slice(2).map((write) => write.body.stage).sort()).toEqual(["new", "registered"]);
  for (const write of writes.slice(2)) expect(write.body.expectedUpdatedAt).toBe(savedAt);
  await expect(stageSelect(page, "Walk-in Referral")).toHaveValue("new");
  await expect(stageSelect(page, "Evan Wright")).toHaveValue("registered");
});

test("dragging into a collapsed column still moves the contact", async ({ page }) => {
  const writes = await mockContactWrites(page);
  await openPipeline(page);
  await page.getByRole("button", { name: "Collapse Registered", exact: true }).click();
  // dragTo scrolls the entire tall column into view before dropping. Move the
  // pointer to the visible top of the column, as a person would, instead.
  await card(page, "Walk-in Referral").hover({ position: { x: 6, y: 60 } });
  const target = await page.getByRole("button", { name: "Expand Registered", exact: true }).boundingBox();
  expect(target).not.toBeNull();
  await page.mouse.down();
  await page.mouse.move(target!.x + 24, target!.y + 50, { steps: 12 });
  await page.mouse.move(target!.x + 24, target!.y + 51, { steps: 2 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText("1 contact moved to Registered.");
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ stage: "registered", expectedUpdatedAt: expect.any(String) });
  await page.getByRole("button", { name: "Expand Registered", exact: true }).click();
  await expect(column(page, "registered").getByRole("link", { name: "Walk-in Referral", exact: true })).toBeVisible();
});

test("failed stage changes restore the card and the board retry keeps the original request", async ({ page }) => {
  const writes: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact/*", async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill(writes.length === 1
      ? { status: 409, json: { error: "This contact changed. Refresh and try again." } }
      : { status: 200, json: { ok: true, lead: { updatedAt: savedAt } } });
  });
  await openPipeline(page);
  const actionAlert = page.getByRole("region", { name: "Pipeline board", exact: true }).getByRole("alert");
  await stageSelect(page, "Walk-in Referral").selectOption("engaged");
  await expect(actionAlert).toContainText("This contact changed.");
  await expect(stageSelect(page, "Walk-in Referral")).toHaveValue("new");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("moved to Engaged");
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  await expect(actionAlert).toHaveCount(0);
});

test("card actions retain assignment, quick task creation, and the full contact link", async ({ page }) => {
  const writes = await mockContactWrites(page);
  const tasks: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/task", async (route) => {
    tasks.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await openPipeline(page);
  const evan = card(page, "Evan Wright");
  const contactURL = await evan.getByRole("link", { name: "Evan Wright", exact: true }).getAttribute("href");
  await evan.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(page.getByRole("link", { name: /Open contact/ })).toHaveAttribute("href", contactURL!);
  await page.getByRole("combobox", { name: "Assign to", exact: true }).selectOption("Team");
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({ owner: "Team", expectedUpdatedAt: expect.any(String) });
  await expect(page.getByRole("combobox", { name: "Assign to", exact: true })).toHaveCount(0);
  await evan.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("textbox", { name: "Quick task", exact: true }).fill("  Send the workshop details  ");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect.poll(() => tasks.length).toBe(1);
  expect(tasks).toEqual([{ email: "evan@example.com", title: "Send the workshop details" }]);
  await expect(page.getByRole("textbox", { name: "Quick task", exact: true })).toHaveCount(0);
});

test("Add contact retains all fields, validation, and retry without losing the draft", async ({ page }) => {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/crm/contact", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(requests.length === 1
      ? { status: 503, json: { error: "Temporarily unavailable" } }
      : { status: 200, json: { ok: true } });
  });
  await openPipeline(page);
  await page.getByRole("button", { name: /\+ Add contact/, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add contact", exact: true });
  await dialog.getByRole("button", { name: "Add contact", exact: true }).click();
  await expect(dialog).toContainText("Name and a valid email are required.");
  expect(requests).toHaveLength(0);
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Pipeline Test Contact");
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("pipeline-test@example.com");
  await dialog.getByRole("textbox", { name: "Phone", exact: true }).fill("+1 405 555 0100");
  await dialog.getByRole("textbox", { name: "Source", exact: true }).fill("referral");
  await dialog.getByRole("combobox", { name: "Stage", exact: true }).selectOption("engaged");
  await dialog.getByRole("combobox", { name: "Owner", exact: true }).selectOption("Team");
  await dialog.getByRole("button", { name: "Add contact", exact: true }).click();
  await expect(dialog).toContainText("Could not create the contact.");
  await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Pipeline Test Contact");
  await dialog.getByRole("button", { name: "Add contact", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual({ name: "Pipeline Test Contact", email: "pipeline-test@example.com", phone: "+1 405 555 0100", source: "referral", stage: "engaged", owner: "Team" });
  expect(requests[1]).toEqual(requests[0]);
});

test("mobile keeps the board first and every stage reachable without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPipeline(page);
  const board = page.getByRole("region", { name: "Pipeline board", exact: true });
  const summary = page.getByRole("region", { name: "Pipeline summary", exact: true });
  expect((await board.boundingBox())!.y).toBeLessThan((await summary.boundingBox())!.y);
  for (const [stage, name] of [
    ["Registered", "Evan Wright"], ["Engaged", "Rosa Jimenez"], ["Call booked", "Grace Okafor"], ["Client", "Ana Martins"],
  ]) {
    const tab = board.getByRole("button", { name: new RegExp(`^${stage}\\s+\\d+$`) });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    await expect(card(page, name)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await board.getByRole("button", { name: /^Lost\s+0$/ }).click();
  await expect(board.getByText("No contacts in Lost.", { exact: true })).toBeVisible();
  await board.getByRole("button", { name: /^New\s+1$/ }).click();
  await expect(card(page, "Walk-in Referral")).toBeVisible();
  await expect(stageSelect(page, "Walk-in Referral")).toBeVisible();
});
