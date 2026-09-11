import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  localMode: vi.fn(), databaseConfig: vi.fn(), localLimit: vi.fn(), publicLimit: vi.fn(), save: vi.fn(), verify: vi.fn(), issueSession: vi.fn(),
}));
vi.mock("@/lib/credit-check", () => ({
  isCreditCheckLocalMode: mocks.localMode, hasCreditCheckDatabaseConfig: mocks.databaseConfig,
  consumeLocalCreditCheckRateLimit: mocks.localLimit, saveCreditCheckSubmission: mocks.save,
}));
vi.mock("@/lib/public-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/public-api")>(), consumePublicRateLimit: mocks.publicLimit,
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.verify }));
vi.mock("@/lib/credit-reports", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/credit-reports")>(), issueCreditReportSession: mocks.issueSession,
}));

import { POST } from "./route";

const valid = {
  name: "Test Visitor", email: "test@example.com", phone: "2025550100",
  answers: { companies: ["Midland Credit Management", "True Accord"] },
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/credit-check", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
}

describe("credit-check public API", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TURNSTILE_SECRET", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    mocks.localMode.mockReturnValue(true);
    mocks.databaseConfig.mockReturnValue(false);
    mocks.localLimit.mockReturnValue(true);
    mocks.publicLimit.mockResolvedValue(true);
    mocks.verify.mockResolvedValue(true);
    mocks.save.mockResolvedValue({ id: "test-id", mode: "local" });
    mocks.issueSession.mockResolvedValue({ token: "x".repeat(43), expiresAt: new Date(Date.now() + 600_000).toISOString() });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllEnvs(); });

  it("reports a confirmed local save without returning personal details", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, id: "test-id", mode: "local" });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Strict");
    expect(response.headers.get("set-cookie")).toContain("Path=/api/credit-check");
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ name: valid.name, phone: "+12025550100", answers: valid.answers }));
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("refuses success when persistence fails", async () => {
    mocks.save.mockRejectedValue(new Error("private filesystem path or credential"));
    const response = await POST(request(valid));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "We couldn't save your answers. Please try again." });
  });

  it("does not claim a ready upload when session persistence fails", async () => {
    mocks.issueSession.mockRejectedValue(new Error("storage is unavailable"));
    const response = await POST(request(valid));
    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects partial answers before calling persistence", async () => {
    const response = await POST(request({ ...valid, answers: { companies: [] } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ fieldErrors: { answers: expect.any(String) } });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects a JSON null body without a server error", async () => {
    expect((await POST(request(null))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies even without a content-length header", async () => {
    const response = await POST(request({ ...valid, name: "a".repeat(17000) }));
    expect(response.status).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and cross-origin requests", async () => {
    const malformed = new Request("http://localhost:3000/api/credit-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect((await POST(malformed)).status).toBe(400);
    expect((await POST(request(valid, { Origin: "https://another.example" }))).status).toBe(403);
    expect((await POST(request(valid, { "Content-Type": "text/plain" }))).status).toBe(415);
  });

  it("accepts the browser Host when Next uses localhost internally", async () => {
    const response = await POST(request(valid, {
      Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000",
    }));
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledOnce();
  });

  it("rejects a different origin even when it matches Next's internal hostname", async () => {
    const response = await POST(request(valid, {
      Host: "127.0.0.1:3000", Origin: "http://localhost:3000",
    }));
    expect(response.status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("does not trust forwarded host headers or malformed authority values", async () => {
    expect((await POST(request(valid, {
      Host: "127.0.0.1:3000", Origin: "https://another.example", "X-Forwarded-Host": "another.example",
    }))).status).toBe(403);
    expect((await POST(request(valid, {
      Host: "127.0.0.1:3000@another.example", Origin: "http://another.example",
    }))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("fails closed for missing production configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.localMode.mockReturnValue(false);
    expect((await POST(request(valid))).status).toBe(503);
    mocks.databaseConfig.mockReturnValue(true);
    expect((await POST(request(valid))).status).toBe(503);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("does not bypass live security for configured databases in development", async () => {
    mocks.localMode.mockReturnValue(false);
    mocks.databaseConfig.mockReturnValue(true);
    expect((await POST(request(valid))).status).toBe(503);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("applies the public rate limiter and Turnstile before a production save", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    mocks.localMode.mockReturnValue(false);
    mocks.databaseConfig.mockReturnValue(true);
    mocks.save.mockResolvedValue({ id: "live-test-id", mode: "live" });
    const response = await POST(request({ ...valid, turnstileToken: "test-token" }));
    expect(response.status).toBe(200);
    expect(mocks.publicLimit).toHaveBeenCalledWith(expect.any(Request), "registration", 10, 600);
    expect(mocks.verify).toHaveBeenCalledWith(expect.any(Request), "test-token");
    expect(await response.json()).toEqual({ ok: true, id: "live-test-id", mode: "live" });
  });

  it("blocks failed verification and exhausted rate limits before persistence", async () => {
    mocks.localLimit.mockReturnValue(false);
    expect((await POST(request(valid))).status).toBe(429);
    mocks.localMode.mockReturnValue(false);
    mocks.databaseConfig.mockReturnValue(true);
    vi.stubEnv("TURNSTILE_SECRET", "test-secret");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    mocks.verify.mockResolvedValue(false);
    expect((await POST(request(valid))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
