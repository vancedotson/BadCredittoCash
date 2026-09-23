import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  email: vi.fn(), calendar: vi.fn(), notifications: vi.fn(), retention: vi.fn(), digest: vi.fn(), reconcile: vi.fn(), rpc: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ processEmailBacklog: mocks.email }));
vi.mock("@/lib/google-calendar", () => ({ reconcileGoogleCalendarBookings: mocks.calendar }));
vi.mock("@/lib/store", () => ({ syncCrmNotifications: mocks.notifications }));
vi.mock("@/lib/analytics-retention", () => ({ cleanupAnonymousAnalytics: mocks.retention }));
vi.mock("@/lib/overdue-digest", () => ({ sendDailyOverdueDigest: mocks.digest }));
vi.mock("@/lib/credit-report-reconciliation", () => ({ reconcileCreditReportArtifacts: mocks.reconcile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));

import { POST } from "./route";

describe("maintenance cron credit-report reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", "test-only-cron-secret");
    vi.stubEnv("LIVE_WEBINAR_ENABLED", "false");
    mocks.email.mockResolvedValue({ processed: 0 });
    mocks.calendar.mockResolvedValue({ checked: 0 });
    mocks.notifications.mockResolvedValue(undefined);
    mocks.retention.mockResolvedValue({ removed: 0 });
    mocks.digest.mockResolvedValue({ sent: false });
    mocks.reconcile.mockResolvedValue({ dryRun: false, limit: 25, attempts: 0, attemptsCompleted: 0, attemptsAbandoned: 0, obsoleteObjects: 0, objectsRemoved: 0, protectedCurrent: 0, deferred: 0, failed: 0, hasMore: false });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects requests without the existing cron secret before any job runs", async () => {
    const response = await POST(new Request("http://localhost/api/internal/email-cron", { method: "POST" }));
    expect(response.status).toBe(404);
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("runs a fixed bounded batch under cron authorization and returns safe counts", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await POST(new Request("http://localhost/api/internal/email-cron", {
      method: "POST", headers: { "x-vance-cron-secret": "test-only-cron-secret" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith({ limit: 25 });
    expect(await response.json()).toMatchObject({ ok: true, creditReports: { attempts: 0, objectsRemoved: 0 } });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/object_path|contact_id|\.pdf|fileName/i);
  });

  it("isolates reconciliation failures and does not expose their details", async () => {
    mocks.reconcile.mockRejectedValue(new Error("private object key and provider error"));
    const response = await POST(new Request("http://localhost/api/internal/email-cron", {
      method: "POST", headers: { "x-vance-cron-secret": "test-only-cron-secret" },
    }));
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body).ok).toBe(false);
    expect(body).toContain("Credit-report reconciliation failed.");
    expect(body).not.toContain("private object key");
    expect(body).not.toContain("provider error");
  });
});
