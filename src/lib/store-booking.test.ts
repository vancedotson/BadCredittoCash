import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), admin: vi.fn(), available: vi.fn(), update: vi.fn(), create: vi.fn(), attach: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/google-calendar", () => ({
  assertGoogleCalendarAvailable: mocks.available,
  updateGoogleCalendarEvent: mocks.update,
  createGoogleCalendarEvent: mocks.create,
  attachGoogleEventToBooking: mocks.attach,
  deleteGoogleCalendarEvent: mocks.delete,
  GoogleCalendarConflictError: class GoogleCalendarConflictError extends Error {},
}));

import { cancelBooking, rescheduleBooking } from "./store";

const details = { id: "booking-id", starts_at: "2030-10-14T12:00:00Z", ends_at: "2030-10-14T12:30:00Z", timezone: "UTC", provider_event_id: "old-event", contact_name: "Person", contact_email: "person@example.test", contact_phone: null };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: [details], error: null });
  mocks.available.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue("new-event");
  mocks.attach.mockResolvedValue(undefined);
  mocks.delete.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("authoritative booking synchronization", () => {
  it("stops before rescheduling when provider detachment fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [details], error: null }).mockResolvedValueOnce({ data: null, error: { message: "missing RPC" } });
    await expect(rescheduleBooking("booking-id", "2030-10-15T12:00:00Z")).rejects.toThrow("detach");
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("detaches before CRM reschedule and updates the remembered event afterward", async () => {
    await rescheduleBooking("booking-id", "2030-10-15T12:00:00Z");
    const calls = mocks.rpc.mock.calls.map((call) => call[0]);
    expect(calls.indexOf("clear_booking_google_event")).toBeLessThan(calls.indexOf("reschedule_booking_and_notify"));
    expect(mocks.update).toHaveBeenCalledWith("old-event", expect.objectContaining({ startsAt: "2030-10-15T12:00:00.000Z" }));
    expect(mocks.attach).toHaveBeenCalledWith("booking-id", "old-event");
  });

  it("restores the old provider link when CRM reschedule fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [details], error: null }).mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "slot conflict" } }).mockResolvedValueOnce({ data: null, error: null });
    await expect(rescheduleBooking("booking-id", "2030-10-15T12:00:00Z")).rejects.toThrow("slot conflict");
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual(["get_booking_calendar_details", "clear_booking_google_event", "reschedule_booking_and_notify", "set_booking_google_event"]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("warns and remains detached when reattachment fails", async () => {
    mocks.attach.mockRejectedValue(new Error("attach failed"));
    await rescheduleBooking("booking-id", "2030-10-15T12:00:00Z");
    expect(mocks.attach).toHaveBeenCalledWith("booking-id", "old-event");
    expect(mocks.rpc).toHaveBeenCalledWith("record_funnel_event", expect.objectContaining({ p_properties: expect.objectContaining({ reason: "google_reschedule_sync_failed" }) }));
  });

  it("keeps cancellation committed when external deletion and warning persistence fail", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [details], error: null }).mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "warning unavailable" } });
    mocks.delete.mockRejectedValue(new Error("calendar unavailable"));
    await expect(cancelBooking("booking-id")).resolves.toBeUndefined();
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual(["get_booking_calendar_details", "cancel_booking_and_notify", "record_funnel_event"]);
    expect(console.error).toHaveBeenCalled();
  });
});
