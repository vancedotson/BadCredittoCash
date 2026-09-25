import { expect, test, type Page } from "@playwright/test";
import type { PublicLiveWebinarSession } from "../src/lib/live-webinar-types";

const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";
const now = Date.parse("2026-10-15T18:00:00Z");
type Activity = { sessionId: string; event: string; clientEventId: string; props: Record<string, unknown> };

function session(overrides: Partial<PublicLiveWebinarSession> = {}): PublicLiveWebinarSession {
  return { id: sessionA, slug: "october-live", title: "October collector rights session",
    startsAt: new Date(now - 60_000).toISOString(), endsAt: new Date(now + 3_600_000).toISOString(),
    timezone: "America/New_York", status: "scheduled", streamProvider: "cloudflare", cloudflareLiveInputId: "0123456789abcdef0123456789abcdef",
    embedUrl: "https://customer-ab12.cloudflarestream.com/0123456789abcdef0123456789abcdef/webRTC/play",
    replayUrl: null, replayPublished: false, replayAvailableUntil: null, automationEnabled: false,
    scheduleVersion: 1, ...overrides };
}

async function mockPublicApis(page: Page, initial: PublicLiveWebinarSession | null, linked = true) {
  let current = initial;
  let failNextQuestion = false;
  let failNextSession = false;
  let sessionUnavailable = false;
  let participantLinked = linked;
  const activities: Activity[] = [];
  const leads: Record<string, unknown>[] = [];
  const bookings: Record<string, unknown>[] = [];
  let whepPosts = 0;
  await page.clock.install({ time: now });
  await page.addInitScript(() => {
    window.turnstile = {
      render: (_element, options) => { queueMicrotask(() => options.callback("mocked-local-token")); return "mock"; },
      remove: () => {},
    };
    class MockPeerConnection {
      connectionState = "connecting";
      ontrack: ((event: { streams: MediaStream[]; track: { id: string } }) => void) | null = null;
      onconnectionstatechange: (() => void) | null = null;
      addTransceiver() {}
      async createOffer() { return { type: "offer", sdp: "v=0\r\n" }; }
      async setLocalDescription() {}
      async setRemoteDescription() {
        queueMicrotask(() => this.ontrack?.({ streams: [new MediaStream()], track: { id: "mock-track" } }));
      }
      close() { this.connectionState = "closed"; }
    }
    Object.defineProperty(window, "RTCPeerConnection", { configurable: true, value: MockPeerConnection });
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === "/api/live/session") {
      if (failNextSession || sessionUnavailable) {
        failNextSession = false;
        await route.fulfill({ status: 503, json: { error: "Session temporarily unavailable" } });
        return;
      }
      await route.fulfill({ json: { session: current ? { ...current, embedUrl: participantLinked ? current.embedUrl : null,
        replayUrl: null, replayPublished: false, replayAvailableUntil: null, cloudflareLiveInputId: null } : null, participant: participantLinked && current ? {
        sessionId: current.id, registrationId: `registration-${current.id}`,
      } : null } });
    } else if (path === "/api/live/activity") {
      const body = route.request().postDataJSON() as Activity;
      activities.push(body);
      if (failNextQuestion && body.event === "live_question_asked") {
        failNextQuestion = false;
        await route.fulfill({ status: 503, json: { ok: false, error: "Try again" } });
      } else await route.fulfill({ json: { ok: true } });
    } else if (path === "/api/lead" && method === "POST") {
      leads.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true, sessionId: current?.id, lead: { email: "alex@example.com" } } });
    } else if (path === "/api/book") {
      if (method === "POST") bookings.push(route.request().postDataJSON());
      await route.fulfill({ json: method === "GET" ? { startsAt: [], busy: [] } : {
        ok: true, booking: { id: "mock-booking", startsAt: new Date(now).toISOString(), endsAt: new Date(now + 1_800_000).toISOString(), timezone: "UTC" },
      } });
    } else await route.fulfill({ json: { ok: true } });
  });
  await page.route("https://customer-ab12.cloudflarestream.com/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, DELETE", "Access-Control-Allow-Headers": "Content-Type" } });
    } else if (route.request().method() === "POST") {
      whepPosts += 1;
      await route.fulfill({ status: 201, headers: { "Access-Control-Allow-Origin": "*", Location: "https://customer-ab12.cloudflarestream.com/session/mock" }, body: "v=0\\r\\n" });
    } else await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  });
  return { activities, leads, bookings, setSession: (value: PublicLiveWebinarSession | null) => { current = value; },
    whepPosts: () => whepPosts,
    setParticipantLinked: (value: boolean) => { participantLinked = value; },
    setSessionUnavailable: (value: boolean) => { sessionUnavailable = value; },
    rejectNextSession: () => { failNextSession = true; },
    rejectNextQuestion: () => { failNextQuestion = true; } };
}

test("an unscheduled live page presents no actions", async ({ page }) => {
  await page.route("**/api/live/session**", (route) => route.fulfill({ json: { session: null, participant: null } }));
  await page.goto("/live");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("isn’t on the calendar yet");
  await expect(page.getByRole("main").getByRole("link", { name: "Book a free strategy call" })).toHaveAttribute("href", "/book");
  await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
});

test("live previews cannot register, book, send questions, or record activity", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  await page.goto(`/live?session=${sessionA}&preview=1`);
  await expect(page.getByRole("button", { name: "Save my seat", exact: true }).first()).toBeDisabled();
  await page.goto(`/live/call?session=${sessionA}&preview=1`);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("alex@example.com");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Alex Test");
  await page.getByRole("button", { name: "Continue to choose a time" }).click();
  await expect(page.getByRole("button", { name: "Confirm my call" })).toBeDisabled();
  await page.goto(`/live/room?session=${sessionA}&preview=1`);
  await expect(page.getByRole("textbox", { name: "ASK VANCE A QUESTION" })).toBeDisabled();
  expect(mocks.leads).toEqual([]);
  expect(mocks.bookings).toEqual([]);
  expect(mocks.activities).toEqual([]);
});

test("questions acknowledge persistence, retain a failed draft, and reuse the retry identity", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  mocks.rejectNextQuestion();
  await page.goto(`/live/room?session=${sessionA}`);
  const input = page.getByRole("textbox", { name: "ASK VANCE A QUESTION" });
  const send = page.getByRole("button", { name: "Send to Vance" });
  await input.fill("Can I request written confirmation?");
  await send.click();
  await expect(page.getByRole("alert").filter({ hasText: "That didn't send" })).toBeVisible();
  await expect(input).toHaveValue("Can I request written confirmation?");
  await expect(page.getByText("Your questions", { exact: true })).toHaveCount(0);
  await send.click();
  await expect(input).toHaveValue("");
  await expect(page.getByText("Can I request written confirmation?", { exact: true })).toBeVisible();
  await input.fill("How should I document repeated calls?");
  await send.click();
  await expect(page.getByText("How should I document repeated calls?", { exact: true })).toBeVisible();
  const questions = mocks.activities.filter((event) => event.event === "live_question_asked");
  expect(questions).toHaveLength(3);
  expect(questions[0].clientEventId).toBe(questions[1].clientEventId);
  expect(questions[2].clientEventId).not.toBe(questions[1].clientEventId);
  expect(questions.every((event) => event.sessionId === sessionA)).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.dataLayer ?? []))).not.toContain("written confirmation");
});

test("a cold room visit asks for the email joining link and never claims participation", async ({ page }) => {
  const mocks = await mockPublicApis(page, session(), false);
  await page.goto(`/live/room?session=${sessionA}`);
  await expect(page.getByRole("heading", { name: "Open your personal joining link." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Register for this session" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  expect(mocks.activities).toEqual([]);
});

test("an unsent question survives a failed background poll and recovery, while cancellation still takes effect", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  await page.goto(`/live/room?session=${sessionA}`);
  const question = page.getByRole("textbox", { name: "ASK VANCE A QUESTION" });
  await question.fill("What should I document before the next call?");
  mocks.rejectNextSession();
  const failure = page.waitForResponse((response) => response.url().includes("/api/live/session") && response.status() === 503);
  await page.clock.fastForward(60_000);
  await failure;
  await page.clock.runFor(50);
  await expect(question).toHaveValue("What should I document before the next call?");
  mocks.setSession(session({ title: "Session connection restored" }));
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("heading", { name: "Session connection restored" })).toBeVisible();
  await expect(question).toHaveValue("What should I document before the next call?");
  mocks.setSession(session({ status: "cancelled" }));
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("heading", { name: "This session has been cancelled." })).toBeVisible();
  await expect(question).toHaveCount(0);
  expect(mocks.activities.filter((event) => event.event === "live_question_asked")).toEqual([]);
});

test("a failed initial session request stays gated, then a successful poll can open the session", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  mocks.setSessionUnavailable(true);
  await page.goto(`/live/room?session=${sessionA}`);
  await expect(page.getByRole("heading", { name: "We couldn't load this session." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "ASK VANCE A QUESTION" })).toHaveCount(0);
  mocks.setSessionUnavailable(false);
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("textbox", { name: "ASK VANCE A QUESTION" })).toBeEnabled();
});

for (const removal of ["session", "participant"] as const) {
  test(`an authoritative ${removal} removal applies on the next successful poll`, async ({ page }) => {
    const mocks = await mockPublicApis(page, session());
    await page.goto(`/live/room?session=${sessionA}`);
    const question = page.getByRole("textbox", { name: "ASK VANCE A QUESTION" });
    await expect(question).toBeEnabled();
    if (removal === "session") mocks.setSession(null);
    else mocks.setParticipantLinked(false);
    await page.clock.fastForward(60_000);
    if (removal === "session") {
      await expect(page.getByRole("heading", { level: 1 })).toContainText("isn’t on the calendar yet");
      await expect(question).toHaveCount(0);
    } else {
      await expect(page.getByRole("heading", { name: "Open your personal joining link." })).toBeVisible();
      await expect(page.locator("video")).toHaveCount(0);
    }
  });
}

test("doors-open entry becomes participation only after the session starts", async ({ page }) => {
  const mocks = await mockPublicApis(page, session({ startsAt: new Date(now + 240_000).toISOString() }));
  await page.goto(`/live/room?session=${sessionA}`);
  await expect(page.getByText("DOORS OPEN — STARTING SOON")).toBeVisible();
  await expect.poll(() => mocks.activities.some((event) => event.event === "webinar_room_opened")).toBe(true);
  expect(mocks.activities.some((event) => event.event === "live_presence")).toBe(false);
  await page.clock.fastForward(300_000);
  await expect(page.getByText("LIVE NOW", { exact: true })).toBeVisible();
  await expect.poll(() => mocks.activities.some((event) => event.event === "live_presence")).toBe(true);
});

test("a missing stream records room entry without fabricating attendance", async ({ page }) => {
  const mocks = await mockPublicApis(page, session({ embedUrl: null }));
  await page.goto(`/live/room?session=${sessionA}`);
  await expect(page.getByText("LIVE STREAM UNAVAILABLE")).toBeVisible();
  await page.clock.fastForward(65_000);
  expect(mocks.activities.some((event) => event.event === "webinar_room_opened")).toBe(true);
  expect(mocks.activities.some((event) => event.event === "live_presence")).toBe(false);
});

test("legacy replay metadata never exposes a player or replay activity", async ({ page }) => {
  const mocks = await mockPublicApis(page, session({ replayUrl: "https://www.youtube-nocookie.com/embed/replay",
    startsAt: new Date(now - 3_600_000).toISOString(), endsAt: new Date(now - 60_000).toISOString(),
    replayPublished: true, replayAvailableUntil: new Date(now + 30_000).toISOString() }));
  await page.goto(`/live/replay?session=${sessionA}`);
  await expect(page.getByRole("heading", { name: "This session was not recorded." })).toBeVisible();
  await expect(page.locator("iframe, video")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Book a free call" })).toHaveAttribute("href", `/live/call?session=${sessionA}`);
  expect(mocks.activities.filter((event) => event.event === "live_replay_opened")).toEqual([]);
});

test("registered attendees receive native WHEP playback; the room does not embed a public player", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  await page.goto(`/live/room?session=${sessionA}`);
  await expect(page.locator("video[aria-label='Live webinar video']")).toBeVisible();
  await expect(page.getByText("LIVE NOW", { exact: true })).toBeVisible();
  expect(mocks.whepPosts()).toBeGreaterThan(0);
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("published legacy replay metadata stays unavailable", async ({ page }) => {
  const mocks = await mockPublicApis(page, session({ replayUrl: "https://www.youtube-nocookie.com/embed/replay",
    replayPublished: true, replayAvailableUntil: new Date(now + 86_400_000).toISOString() }));
  await page.goto(`/live/replay?session=${sessionA}`);
  await expect(page.getByRole("heading", { name: "This session was not recorded." })).toBeVisible();
  await expect(page.locator("iframe, video")).toHaveCount(0);
  expect(mocks.activities.filter((event) => event.event === "live_replay_opened")).toEqual([]);
});

test("repeat live registrations post distinct sessions and keep the matching confirmation", async ({ page }) => {
  const mocks = await mockPublicApis(page, session({ startsAt: new Date(now + 600_000).toISOString() }));
  for (const id of [sessionA, sessionB]) {
    mocks.setSession(session({ id, startsAt: new Date(now + 600_000).toISOString() }));
    await page.goto(`/live?session=${id}`);
    await page.locator("#live-hero-email").fill("alex@example.com");
    await page.locator("#live-hero-name").fill("Alex Test");
    await page.getByRole("button", { name: "Save my seat", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/live/confirmed\\?session=${id}$`));
    const calendarHref = await page.getByRole("link", { name: "Add to Google Calendar" }).getAttribute("href");
    expect(new URL(calendarHref!).searchParams.get("location")).toContain(`/live/room?session=${id}`);
  }
  expect(mocks.leads.map((lead) => lead.sessionId)).toEqual([sessionA, sessionB]);
  expect(mocks.leads.every((lead) => lead.source === "vance-live-webinar")).toBe(true);
});

test("an explicit cancelled session cannot show a registration form or a player", async ({ page }) => {
  const mocks = await mockPublicApis(page, session({ status: "cancelled" }));
  for (const path of ["/live", "/live/room", "/live/confirmed"]) {
    await page.goto(`${path}?session=${sessionA}`);
    await expect(page.getByRole("heading", { name: "This session has been cancelled." })).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save my seat" })).toHaveCount(0);
  }
  await page.goto(`/live/replay?session=${sessionA}`);
  await expect(page.getByRole("heading", { name: "This session was not recorded." })).toBeVisible();
  await expect(page.locator("iframe, video")).toHaveCount(0);
  expect(mocks.activities).toEqual([]);
});

test("live booking keeps session attribution and succeeds without browser storage", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  await page.addInitScript(() => {
    Object.defineProperty(window.sessionStorage, "setItem", { value: () => { throw new Error("Storage unavailable"); } });
  });
  await page.goto(`/live/call?session=${sessionA}`);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("alex@example.com");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Alex Test");
  await page.getByRole("button", { name: "Continue to choose a time" }).click();
  await page.getByRole("button", { name: "9:00 AM", exact: true }).click();
  await page.getByRole("radio", { name: "Collector calls that won't stop" }).check();
  await page.getByRole("radio", { name: "Not yet", exact: true }).check();
  await page.getByRole("combobox", { name: /how soon/i }).selectOption("As soon as possible");
  await page.getByRole("button", { name: "Confirm my call" }).click();
  await expect(page).toHaveURL(new RegExp(`/live/booked\\?session=${sessionA}$`));
  expect(mocks.bookings).toHaveLength(1);
  expect(mocks.bookings[0]).toMatchObject({ funnel: "live", sessionId: sessionA });
  expect(mocks.activities.some((event) => event.event === "call_booking_started" && event.sessionId === sessionA)).toBe(true);
});

test("shared evergreen booking keeps its original request and destination", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  await page.goto("/webinar/call");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("alex@example.com");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Alex Test");
  await page.getByRole("button", { name: "Continue to choose a time" }).click();
  await page.getByRole("button", { name: "9:00 AM", exact: true }).click();
  await page.getByRole("radio", { name: "Collector calls that won't stop" }).check();
  await page.getByRole("radio", { name: "Not yet", exact: true }).check();
  await page.getByRole("combobox", { name: /how soon/i }).selectOption("As soon as possible");
  await page.getByRole("button", { name: "Confirm my call" }).click();
  await expect(page).toHaveURL(/\/webinar\/booked$/);
  expect(mocks.bookings).toHaveLength(1);
  expect(mocks.bookings[0]).not.toHaveProperty("funnel");
  expect(mocks.bookings[0]).not.toHaveProperty("sessionId");
  expect(mocks.activities).toEqual([]);
});

test("shared evergreen registration keeps its original source and destination", async ({ page }) => {
  const mocks = await mockPublicApis(page, session());
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email", exact: true }).first().fill("alex@example.com");
  await page.getByRole("textbox", { name: "Name", exact: true }).first().fill("Alex Test");
  const form = page.locator("form").filter({ has: page.getByRole("textbox", { name: "Email", exact: true }).first() });
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/webinar\/confirmed$/);
  expect(mocks.leads).toHaveLength(1);
  expect(mocks.leads[0]).toMatchObject({ source: "vance-webinar" });
  expect(mocks.leads[0]).not.toHaveProperty("sessionId");
});
