import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));

import { isCreditCheckLocalMode, saveCreditCheckSubmission } from "./credit-check";
import type { CreditCheckSubmission } from "./credit-check-validation";

const submission: CreditCheckSubmission = {
  name: "Test Visitor", email: "test@example.com", phone: "+12025550100",
  answers: { how: ["Phone calls"], recognize: "I'm not sure", report: "Haven't checked", disputed: "No", urgency: "As soon as possible" },
  attribution: { firstTouch: {}, lastTouch: {} }, turnstileToken: "never-save-this-token",
};

let testDirectory: string | undefined;

describe("credit-check persistence", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    if (testDirectory) {
      await rm(testDirectory, { recursive: true, force: true });
      testDirectory = undefined;
    }
  });

  it("saves contact details and answers together to a private local file, excluding the token", async () => {
    testDirectory = await mkdtemp(join(tmpdir(), "vance-credit-check-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(testDirectory);
    const saved = await saveCreditCheckSubmission(submission);
    expect(saved.mode).toBe("local");
    const stored = JSON.parse(await readFile(join(testDirectory, ".local", "credit-check", `${saved.id}.json`), "utf8"));
    expect(stored).toMatchObject({ id: saved.id, name: submission.name, email: submission.email, phone: submission.phone, answers: submission.answers });
    expect(stored).not.toHaveProperty("turnstileToken");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps concurrent local submissions in separate files", async () => {
    testDirectory = await mkdtemp(join(tmpdir(), "vance-credit-check-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(testDirectory);
    const saved = await Promise.all([saveCreditCheckSubmission(submission), saveCreditCheckSubmission(submission)]);
    expect(saved[0].id).not.toBe(saved[1].id);
    expect(await readdir(join(testDirectory, ".local", "credit-check"))).toHaveLength(2);
  });

  it("fails closed in production without database configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isCreditCheckLocalMode()).toBe(false);
    await expect(saveCreditCheckSubmission(submission)).rejects.toThrow("not configured");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the dedicated atomic RPC when configured, with no webinar or consent input", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "fake-test-key");
    mocks.rpc.mockResolvedValue({ data: "35e45af4-47e8-4b35-ae31-1cae181289c9", error: null });
    const result = await saveCreditCheckSubmission(submission);
    expect(result.mode).toBe("live");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("submit_credit_check_v1", {
      p_name: submission.name, p_email: submission.email, p_phone: submission.phone, p_answers: submission.answers,
      p_first_touch: {}, p_last_touch: {}, p_visitor_id: null,
    });
  });

  it("does not silently fall back to local storage if the live database fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "fake-test-key");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } });
    expect(isCreditCheckLocalMode()).toBe(false);
    await expect(saveCreditCheckSubmission(submission)).rejects.toThrow("could not be saved");
  });
});
