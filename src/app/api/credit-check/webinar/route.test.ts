import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completed: vi.fn(),
  tag: vi.fn(),
}));

vi.mock("@/lib/credit-reports", () => ({
  CREDIT_REPORT_WEBINAR_COOKIE: "vance_report_webinar",
  reportTokenFromRequest: () => "report-token",
  findCompletedCreditReportSession: mocks.completed,
}));
vi.mock("@/lib/store", () => ({ addTagToContact: mocks.tag }));

import { POST } from "./route";

const url = "https://example.test/api/credit-check/webinar";
const request = (origin = "https://example.test") => new Request(url, { method: "POST", headers: { origin } });

describe("credit-check webinar handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completed.mockResolvedValue({ id: "session", contactId: "contact-1", mode: "live" });
    mocks.tag.mockResolvedValue(null);
  });

  it("tags a completed uploader, grants 48-hour access, and redirects to the room", async () => {
    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.test/webinar/room");
    expect(response.headers.get("set-cookie")).toContain("vance_report_webinar=report-token");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=172800");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.tag).toHaveBeenCalledWith("contact-1", "clicked-video-guide");
  });

  it("does not grant access when all three reports are not present", async () => {
    mocks.completed.mockResolvedValue(null);
    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.test/credit-check/thank-you");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.tag).not.toHaveBeenCalled();
  });

  it("rejects cross-site submissions", async () => {
    const response = await POST(request("https://attacker.test"));
    expect(response.status).toBe(403);
    expect(mocks.completed).not.toHaveBeenCalled();
  });
});
