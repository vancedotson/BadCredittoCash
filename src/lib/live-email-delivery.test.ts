import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), recordEvent: vi.fn() }));
vi.mock("resend", () => ({ Resend: class { emails = { send: mocked.send }; } }));
vi.mock("./supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocked.rpc }) }));
vi.mock("./store", () => ({ recordEvent: mocked.recordEvent }));

import { deliverImmediateSequenceMessage, deliverLiveRegistrationConfirmation, processDueEmails, processEmailBacklog, type MessagePayload } from "./email";
import { verifyLiveParticipantToken } from "./live-webinar-token";

const REGISTRATION_A = "11111111-1111-4111-8111-111111111111";
const REGISTRATION_B = "22222222-2222-4222-8222-222222222222";
const SESSION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RECIPIENT = "participant@example.test";
const NOW = new Date("2026-10-14T17:00:00Z");

type Claimed = { id: string; template_key: string; payload: MessagePayload };
type Due = { message_id: string; email: string; template_key: string; payload: MessagePayload };
let exactClaims: Map<string, Claimed>;
let due: Due[];
let eligible: boolean;
let failureOutcome: { outcome: "retrying" | "failed"; attempts: number; retry_at: string | null };

function payload(overrides: Partial<MessagePayload> = {}): MessagePayload {
  return { registrationId: REGISTRATION_A, sessionId: SESSION_A, accessVersion: 1, sessionVersion: 2,
    title: "October collector rights session", startsAt: "2026-10-15T18:00:00Z", endsAt: "2026-10-15T19:00:00Z",
    timezone: "America/New_York", replayAvailableUntil: "2026-10-18T19:00:00Z", ...overrides };
}

function queue(template = "live_confirmation:1", content = payload(), id = "message-a") {
  due.push({ message_id: id, email: RECIPIENT, template_key: template, payload: content });
}

function sentContent(index = 0) {
  return mocked.send.mock.calls[index][0] as {
    to: string; subject: string; text: string; html: string; headers?: Record<string, string>;
  };
}

function htmlLinks(html: string): URL[] {
  return Array.from(html.matchAll(/href="([^"]+)"/g), (match) => new URL(match[1].replaceAll("&amp;", "&")));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("LIVE_WEBINAR_ENABLED", "true");
  vi.stubEnv("EMAIL_MODE", "production");
  vi.stubEnv("APP_BASE_URL", "https://example.test/");
  vi.stubEnv("RESEND_API_KEY", "mocked-resend-key");
  vi.stubEnv("EMAIL_SIGNING_SECRET", "test-only-live-email-signing-secret-not-a-real-secret");
  vi.stubEnv("EMAIL_TEST_RECIPIENT", "controlled@example.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  exactClaims = new Map();
  due = [];
  eligible = true;
  failureOutcome = { outcome: "retrying", attempts: 1, retry_at: "2026-10-14T17:05:00Z" };
  mocked.send.mockResolvedValue({ data: { id: "provider-a" }, error: null });
  mocked.recordEvent.mockResolvedValue(undefined);
  mocked.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_live_webinar_email_v1") {
      const key = String(args.p_registration_id);
      const claimed = exactClaims.get(key);
      exactClaims.delete(key);
      return { data: claimed ? [claimed] : [], error: null };
    }
    if (name === "claim_due_scheduled_emails_v2" || name === "claim_due_scheduled_emails") {
      const batch = due.splice(0);
      return { data: batch, error: null };
    }
    if (name === "claim_scheduled_email") return { data: [{ id: "legacy-message", template_key: args.p_template_key, payload: {} }], error: null };
    if (name === "email_message_is_eligible_v2") return { data: eligible, error: null };
    if (name === "release_scheduled_email_claim_v1" || name === "complete_scheduled_email") return { data: true, error: null };
    if (name === "fail_scheduled_email") return { data: [failureOutcome], error: null };
    throw new Error(`Unexpected mocked RPC: ${name}`);
  });
});

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("live email delivery integration", () => {
  it("claims the exact registration and does not resend when its committed message is already claimed", async () => {
    exactClaims.set(REGISTRATION_A, { id: "message-a", template_key: "live_confirmation:1", payload: payload() });
    exactClaims.set(REGISTRATION_B, { id: "message-b", template_key: "live_confirmation:1",
      payload: payload({ registrationId: REGISTRATION_B, sessionId: SESSION_B }) });
    await deliverLiveRegistrationConfirmation(REGISTRATION_A, RECIPIENT);
    await deliverLiveRegistrationConfirmation(REGISTRATION_A, RECIPIENT);
    await deliverLiveRegistrationConfirmation(REGISTRATION_B, RECIPIENT);
    expect(mocked.rpc).toHaveBeenCalledWith("claim_live_webinar_email_v1", {
      p_registration_id: REGISTRATION_A, p_template_key: "live_confirmation:1",
    });
    expect(mocked.rpc).toHaveBeenCalledWith("claim_live_webinar_email_v1", {
      p_registration_id: REGISTRATION_B, p_template_key: "live_confirmation:1",
    });
    expect(mocked.rpc.mock.calls.some(([name]) => name === "claim_scheduled_email")).toBe(false);
    expect(mocked.send).toHaveBeenCalledTimes(2);
    expect(mocked.send.mock.calls.map((call) => call[1])).toEqual([
      { idempotencyKey: "vance-message-a" }, { idempotencyKey: "vance-message-b" },
    ]);
  });

  it("does not even claim an immediate live message while the feature is disabled", async () => {
    vi.stubEnv("LIVE_WEBINAR_ENABLED", "false");
    await deliverLiveRegistrationConfirmation(REGISTRATION_A, RECIPIENT);
    expect(mocked.rpc).not.toHaveBeenCalled();
    expect(mocked.send).not.toHaveBeenCalled();
  });

  it.each([true, false])("selects the compatible due-claim function with live flag %s", async (enabled) => {
    vi.stubEnv("LIVE_WEBINAR_ENABLED", String(enabled));
    await processDueEmails(100);
    expect(mocked.rpc).toHaveBeenCalledWith(enabled ? "claim_due_scheduled_emails_v2" : "claim_due_scheduled_emails",
      enabled ? { p_limit: 10, p_include_live: true } : { p_limit: 10 });
  });

  it.each(["feature-disabled", "no-longer-eligible"])("releases a live claim without dispatch when %s", async (reason) => {
    if (reason === "feature-disabled") vi.stubEnv("LIVE_WEBINAR_ENABLED", "false");
    else eligible = false;
    queue();
    expect(await processDueEmails()).toMatchObject({ claimed: 1, processed: 1, skipped: 1, sent: 0, failed: 0 });
    expect(mocked.rpc).toHaveBeenCalledWith("release_scheduled_email_claim_v1", { p_message_id: "message-a" });
    expect(mocked.send).not.toHaveBeenCalled();
    expect(mocked.rpc.mock.calls.some(([name]) => name === "complete_scheduled_email" || name === "fail_scheduled_email")).toBe(false);
  });

  it("uses valid session joining and calendar URLs in both plain text and HTML", async () => {
    queue();
    expect(await processDueEmails()).toMatchObject({ sent: 1, failed: 0 });
    const message = sentContent();
    expect(message.to).toBe(RECIPIENT);
    expect(message.subject).toBe("Your live session joining link");
    expect(message.text).toContain("October collector rights session");
    expect(message.text).toContain("October 15");
    expect(message.text).toContain("America/New_York");
    expect(message.text).not.toContain("{{");
    expect(message.text).not.toContain("/webinar/room");
    expect(message.headers).toBeUndefined();
    const links = htmlLinks(message.html);
    const join = links.find((url) => url.pathname === "/api/live/join")!;
    expect(verifyLiveParticipantToken(join.searchParams.get("token")!, NOW.getTime())).toMatchObject({
      registrationId: REGISTRATION_A, sessionId: SESSION_A,
    });
    expect(links.find((url) => url.pathname === "/api/live/calendar")?.searchParams.get("session")).toBe(SESSION_A);
    expect(mocked.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ email: RECIPIENT,
      props: expect.objectContaining({ funnel: "live", sessionId: SESSION_A, registrationId: REGISTRATION_A }) }));
  });

  it("keeps replay routing and session sales links valid and supplies marketing unsubscribe headers", async () => {
    queue("live_replay:1", payload(), "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    await processDueEmails();
    const message = sentContent();
    const links = htmlLinks(message.html);
    const replay = links.find((url) => url.pathname === "/api/live/join")!;
    expect(replay.searchParams.get("replay")).toBe("1");
    expect(verifyLiveParticipantToken(replay.searchParams.get("token")!, NOW.getTime())).not.toBeNull();
    expect(links.find((url) => url.pathname === "/live/call")?.searchParams.get("session")).toBe(SESSION_A);
    expect(message.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(message.text).toContain("Available until");
    expect(message.text).not.toContain("{{");
  });

  it("gives a replay published 120 days later a usable token and identical retry content from its durable send deadline", async () => {
    const day = 86_400_000;
    const publishedAt = Date.parse(payload().endsAt!) + 120 * day;
    const sendDeadline = publishedAt + 7 * day;
    const messageId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const savedPayload = payload({ replayAvailableUntil: null, sendDeadline: new Date(sendDeadline).toISOString() });
    vi.setSystemTime(publishedAt);
    mocked.send.mockResolvedValueOnce({ data: null, error: { message: "Temporary provider error", statusCode: 503 } });
    queue("live_replay:1", savedPayload, messageId);
    expect(await processDueEmails()).toMatchObject({ retrying: 1, sent: 0 });

    const firstMessage = sentContent();
    const replay = htmlLinks(firstMessage.html).find((url) => url.pathname === "/api/live/join")!;
    const firstToken = replay.searchParams.get("token")!;
    expect(replay.searchParams.get("replay")).toBe("1");
    expect(verifyLiveParticipantToken(firstToken, publishedAt)).toMatchObject({
      registrationId: REGISTRATION_A, sessionId: SESSION_A, expiresAt: sendDeadline + day,
    });
    expect(firstMessage.text).toContain("No expiry date is currently set.");

    await vi.advanceTimersByTimeAsync(30 * 60_000);
    queue("live_replay:1", savedPayload, messageId);
    expect(await processDueEmails()).toMatchObject({ sent: 1, retrying: 0 });
    const retryMessage = sentContent(1);
    const retryToken = htmlLinks(retryMessage.html).find((url) => url.pathname === "/api/live/join")!.searchParams.get("token");
    expect(retryToken).toBe(firstToken);
    expect(verifyLiveParticipantToken(retryToken!, Date.now())).not.toBeNull();
    expect(retryMessage).toEqual(firstMessage);
    expect(mocked.send.mock.calls[1][1]).toEqual({ idempotencyKey: `vance-${messageId}` });
    expect(mocked.send.mock.calls[1][1]).toEqual(mocked.send.mock.calls[0][1]);
  });

  it("keeps legacy immediate registration on its original claim, template, and training link", async () => {
    await deliverImmediateSequenceMessage(RECIPIENT, "pre_webinar");
    expect(mocked.rpc).toHaveBeenCalledWith("claim_scheduled_email", { p_email: RECIPIENT, p_template_key: "pre_webinar:1" });
    expect(sentContent().text).toContain("https://example.test/webinar/room");
    expect(sentContent().text).not.toContain("/api/live/join");
    expect(mocked.rpc.mock.calls.some(([name]) => name === "email_message_is_eligible_v2")).toBe(false);
    expect(mocked.send.mock.calls[0][1]).toEqual({ idempotencyKey: "vance-legacy-message" });
  });

  it("routes test-mode delivery to the controlled address while recording the intended contact", async () => {
    vi.stubEnv("EMAIL_MODE", "test");
    queue();
    await processDueEmails();
    expect(sentContent().to).toBe("controlled@example.test");
    expect(mocked.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ email: RECIPIENT,
      props: expect.objectContaining({ testMode: true }) }));
  });

  it.each([
    ["live_confirmation:1", false], ["live_reminder_day:1", false], ["live_reminder_soon:1", false],
    ["live_attended:1", true], ["live_no_show:1", true], ["live_replay:1", true],
    ["live_rescheduled:1", false], ["live_cancelled:1", false],
  ])("renders %s with complete fields and the correct promotional classification", async (template, promotional) => {
    queue(String(template), payload(), "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(await processDueEmails()).toMatchObject({ sent: 1, failed: 0 });
    const message = sentContent();
    expect(message.text).toContain("October collector rights session");
    expect(message.text).not.toContain("{{");
    expect(message.text).not.toContain("/webinar/room");
    expect(Boolean(message.headers?.["List-Unsubscribe"])).toBe(promotional);
  });

  it.each([408, 409, 425, 429, 500, 503])("retries provider status %s with the same persisted message identity", async (statusCode) => {
    mocked.send.mockResolvedValueOnce({ data: null, error: { message: "Temporary provider error", statusCode } });
    queue();
    expect(await processDueEmails()).toMatchObject({ retrying: 1, sent: 0, failed: 0 });
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({
      p_message_id: "message-a", p_retryable: true, p_max_attempts: 3,
    }));
    await vi.advanceTimersByTimeAsync(300_000);
    queue();
    expect(await processDueEmails()).toMatchObject({ sent: 1 });
    expect(mocked.send.mock.calls.map((call) => call[1])).toEqual([
      { idempotencyKey: "vance-message-a" }, { idempotencyKey: "vance-message-a" },
    ]);
    expect(sentContent(1)).toEqual(sentContent(0));
  });

  it("dead-letters a permanent provider rejection", async () => {
    mocked.send.mockResolvedValue({ data: null, error: { message: "Invalid recipient", statusCode: 422 } });
    failureOutcome = { outcome: "failed", attempts: 1, retry_at: null };
    queue();
    expect(await processDueEmails()).toMatchObject({ failed: 1, retrying: 0, sent: 0 });
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({ p_retryable: false }));
  });

  it("reports dead-letter when the database exhausts a transient failure's retry budget", async () => {
    mocked.send.mockRejectedValue(new Error("Network interrupted"));
    failureOutcome = { outcome: "failed", attempts: 3, retry_at: null };
    queue();
    expect(await processDueEmails()).toMatchObject({ failed: 1, retrying: 0, sent: 0 });
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({ p_retryable: true, p_max_attempts: 3 }));
  });

  it("preserves provider idempotency after provider acceptance but failed database acknowledgment", async () => {
    const implementation = mocked.rpc.getMockImplementation()!;
    let rejectCompletion = true;
    mocked.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "complete_scheduled_email" && rejectCompletion) {
        rejectCompletion = false;
        return { data: null, error: { message: "Database temporarily unavailable" } };
      }
      return implementation(name, args);
    });
    queue();
    expect(await processDueEmails()).toMatchObject({ retrying: 1 });
    queue();
    expect(await processDueEmails()).toMatchObject({ sent: 1 });
    expect(mocked.send.mock.calls[0][1]).toEqual(mocked.send.mock.calls[1][1]);
  });

  it("does not resend a successfully completed delivery if activity logging fails", async () => {
    mocked.recordEvent.mockRejectedValue(new Error("Timeline unavailable"));
    queue();
    expect(await processDueEmails()).toMatchObject({ sent: 1, failed: 0 });
    expect(mocked.rpc.mock.calls.some(([name]) => name === "fail_scheduled_email")).toBe(false);
  });

  it("dead-letters an unknown template without invoking the provider", async () => {
    failureOutcome = { outcome: "failed", attempts: 1, retry_at: null };
    queue("live_unknown:1");
    expect(await processDueEmails()).toMatchObject({ failed: 1, sent: 0 });
    expect(mocked.send).not.toHaveBeenCalled();
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({ p_retryable: false }));
  });

  it("fails explicitly before provider dispatch when the provider key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    failureOutcome = { outcome: "failed", attempts: 1, retry_at: null };
    queue();
    expect(await processDueEmails()).toMatchObject({ failed: 1, sent: 0 });
    expect(mocked.send).not.toHaveBeenCalled();
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({ p_retryable: false }));
  });

  it("dead-letters an invalid live rendering payload and continues to the next legacy delivery", async () => {
    failureOutcome = { outcome: "failed", attempts: 1, retry_at: null };
    queue("live_confirmation:1", { sessionId: SESSION_A });
    queue("pre_webinar:1", {}, "legacy-next");
    const processing = processDueEmails();
    const result = expect(processing).resolves.toMatchObject({ claimed: 2, processed: 2, failed: 1, sent: 1 });
    await vi.runAllTimersAsync();
    await result;
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({ p_message_id: "message-a", p_retryable: false }));
    expect(mocked.send).toHaveBeenCalledTimes(1);
    expect(sentContent().text).toContain("/webinar/room");
  });

  it.each([
    { registrationId: "invalid-registration" },
    { sessionId: "invalid-session" },
    { endsAt: "not-a-date" },
    { accessVersion: 1.5 },
  ])("rejects malformed signing context %j before provider dispatch", async (invalid) => {
    failureOutcome = { outcome: "failed", attempts: 1, retry_at: null };
    queue("live_confirmation:1", payload(invalid));
    expect(await processDueEmails()).toMatchObject({ failed: 1, sent: 0 });
    expect(mocked.send).not.toHaveBeenCalled();
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({ p_retryable: false }));
  });

  it.each([false, true])("continues legacy delivery when live eligibility is uncertain (failure persistence unavailable: %s)", async (failurePersistenceUnavailable) => {
    const implementation = mocked.rpc.getMockImplementation()!;
    mocked.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "email_message_is_eligible_v2" || (name === "fail_scheduled_email" && failurePersistenceUnavailable)) {
        return { data: null, error: { message: "Database temporarily unavailable" } };
      }
      return implementation(name, args);
    });
    queue();
    queue("pre_webinar:1", {}, "legacy-next");
    const processing = processDueEmails();
    const result = expect(processing).resolves.toMatchObject({ claimed: 2, processed: 2, retrying: 1, sent: 1, failed: 0 });
    await vi.runAllTimersAsync();
    await result;
    expect(mocked.send).toHaveBeenCalledTimes(1);
    expect(sentContent().text).toContain("/webinar/room");
    expect(mocked.rpc).toHaveBeenCalledWith("fail_scheduled_email", expect.objectContaining({ p_message_id: "message-a", p_retryable: true }));
  });

  it("reports a global due-claim failure without attempting any delivery", async () => {
    mocked.rpc.mockResolvedValue({ data: null, error: { message: "Claim unavailable" } });
    await expect(processDueEmails()).rejects.toThrow("Claim unavailable");
    expect(mocked.send).not.toHaveBeenCalled();
  });

  it("drains a 100-intent backlog in paced ten-message batches within its budget while isolating one live eligibility error", async () => {
    for (let index = 0; index < 100; index++) {
      queue(index % 2 === 0 ? "live_confirmation:1" : "pre_webinar:1", index % 2 === 0 ? payload() : {}, `capacity-${index}`);
    }
    const implementation = mocked.rpc.getMockImplementation()!;
    const claimedIds: string[] = [];
    const sentIds: string[] = [];
    const sendTimes: number[] = [];
    mocked.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === "claim_due_scheduled_emails_v2") {
        expect(args).toEqual({ p_limit: 10, p_include_live: true });
        const batch = due.splice(0, Number(args.p_limit));
        claimedIds.push(...batch.map((message) => message.message_id));
        return { data: batch, error: null };
      }
      if (name === "email_message_is_eligible_v2" && args.p_message_id === "capacity-2") {
        return { data: null, error: { message: "Temporary eligibility failure" } };
      }
      return implementation(name, args);
    });
    mocked.send.mockImplementation(async (_message: unknown, options: { idempotencyKey: string }) => {
      sendTimes.push(Date.now());
      sentIds.push(options.idempotencyKey.replace(/^vance-/, ""));
      return { data: { id: `provider-${sentIds.length}` }, error: null };
    });
    const startedAt = Date.now();
    const draining = processEmailBacklog(12, 45_000);
    await vi.runAllTimersAsync();
    const result = await draining;
    expect(result.claimed).toBeGreaterThanOrEqual(10);
    expect(result.claimed).toBeLessThan(100);
    expect(result).toMatchObject({ processed: result.claimed, sent: result.claimed - 1, retrying: 1, failed: 0 });
    expect(Date.now() - startedAt).toBeLessThanOrEqual(45_000);
    expect(due).toHaveLength(100 - result.claimed);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(new Set(sentIds).size).toBe(sentIds.length);
    expect(sentIds).toEqual(claimedIds.filter((id) => id !== "capacity-2"));
    expect(claimedIds.filter((id) => Number(id.split("-")[1]) % 2 === 1).every((id) => sentIds.includes(id))).toBe(true);
    for (let index = 1; index < sendTimes.length; index++) {
      expect(sendTimes[index] - sendTimes[index - 1]).toBeGreaterThanOrEqual(500);
    }
  });
});
