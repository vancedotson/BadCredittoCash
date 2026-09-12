import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), participant: vi.fn(), rpc: vi.fn(), admin: vi.fn(), publicClient: vi.fn(), rate: vi.fn(), turnstile: vi.fn(), booked: vi.fn(), available: vi.fn(), createEvent: vi.fn(), deleteEvent: vi.fn(), attachEvent: vi.fn(), busy: vi.fn() }));
vi.mock("@/lib/live-webinars", () => ({ getPublicLiveWebinarSession: mocks.session, resolveLiveParticipant: mocks.participant }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: mocks.publicClient }));
vi.mock("@/lib/public-api", async (original) => ({ ...await original<typeof import("@/lib/public-api")>(), consumePublicRateLimit: mocks.rate }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.turnstile }));
vi.mock("@/lib/automations", () => ({ onBooked: mocks.booked }));
vi.mock("@/lib/google-calendar", () => ({ assertGoogleCalendarAvailable: mocks.available, createGoogleCalendarEvent: mocks.createEvent, deleteGoogleCalendarEvent: mocks.deleteEvent, attachGoogleEventToBooking: mocks.attachEvent, listGoogleBusyIntervals: mocks.busy }));

import { POST } from "./route";

const origin = "https://example.test";
const sessionId = "20000000-0000-4000-8000-000000000001";
const registrationId = "20000000-0000-4000-8000-000000000002";
const booking = { name: "Booking Participant", email: "person@example.test", startsAt: "2030-10-14T12:00:00Z", endsAt: "2030-10-14T12:30:00Z", timezone: "UTC" };
function request(body: unknown, headers: Record<string, string> = {}) { return new Request(`${origin}/api/book`, { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ id: sessionId, status: "scheduled" });
  mocks.participant.mockResolvedValue({ registrationId, sessionId, email: booking.email });
  mocks.rate.mockResolvedValue(true);
  mocks.turnstile.mockResolvedValue(true);
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { id: "booking-id" }, error: null });
  mocks.createEvent.mockResolvedValue("google-event-id");
  mocks.deleteEvent.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("live booking attribution and existing booking lifecycle", () => {
  it("passes verified session participation to the authoritative live booking transaction", async () => {
    expect((await POST(request({ ...booking, funnel: "live", sessionId, registrationId: "forged" }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("book_live_funnel_call_v1", expect.objectContaining({ p_session_id: sessionId, p_registration_id: registrationId }));
    expect(mocks.attachEvent).toHaveBeenCalledWith("booking-id", "google-event-id");
    expect(mocks.booked).toHaveBeenCalledWith(booking.email, new Date(booking.startsAt), "UTC", "booking-id");
  });

  it("does not silently treat supplied webinar session context as an evergreen booking", async () => {
    expect((await POST(request({ ...booking, sessionId }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("book_live_funnel_call_v1", expect.objectContaining({ p_session_id: sessionId }));
  });

  it("supports a direct live booking without inventing registration or attendance", async () => {
    expect((await POST(request({ ...booking, funnel: "live" }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("book_live_funnel_call_v1", expect.objectContaining({ p_session_id: null, p_registration_id: null }));
    expect(mocks.participant).not.toHaveBeenCalled();
  });

  it("lets another person book from a shared browser without inheriting its registration", async () => {
    mocks.participant.mockResolvedValue({ registrationId, sessionId, email: "other-person@example.test" });
    expect((await POST(request({ ...booking, funnel: "live", sessionId }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("book_live_funnel_call_v1", expect.objectContaining({ p_email: booking.email, p_session_id: sessionId, p_registration_id: null }));
  });

  it("rejects malformed or unavailable session context before reserving a calendar event", async () => {
    expect((await POST(request({ ...booking, funnel: "live", sessionId: "bad" }))).status).toBe(400);
    mocks.session.mockResolvedValue(null);
    expect((await POST(request({ ...booking, funnel: "live", sessionId }))).status).toBe(409);
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { body: { ...booking, funnel: "live", preview: true }, headers: {} as Record<string, string> },
    { body: { ...booking, funnel: "live" }, headers: { referer: `${origin}/live/call?preview=1` } },
  ])("does not create bookings or messages from explicit previews", async ({ body, headers }) => {
    expect((await POST(request(body, headers))).status).toBe(409);
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.booked).not.toHaveBeenCalled();
  });

  it("preserves ordinary booking behavior", async () => {
    expect((await POST(request(booking))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("book_funnel_call_v2", expect.objectContaining({ p_email: booking.email }));
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("p_session_id");
    expect(mocks.session).not.toHaveBeenCalled();
  });

  it("retains conflict handling and cleans up the provisional calendar event", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    expect((await POST(request({ ...booking, funnel: "live", sessionId }))).status).toBe(409);
    expect(mocks.deleteEvent).toHaveBeenCalledWith("google-event-id");
    expect(mocks.booked).not.toHaveBeenCalled();
  });
});
