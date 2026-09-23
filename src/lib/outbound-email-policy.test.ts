import { afterEach, describe, expect, it, vi } from "vitest";
import { outboundEmailDecision } from "./outbound-email-policy";

const bookingId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";

describe("central outbound email policy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["onboarding:1", "booking", true],
    [`onboarding:1:${bookingId}`, "booking", true],
    ["onboarding:2", "booking", true],
    [`onboarding:2:${bookingId}`, "booking", true],
    [`booking_rescheduled:${bookingId}:${eventId}`, "booking", true],
    [`booking_reminder:${bookingId}:${eventId}`, "booking", true],
    [`booking_cancelled:${bookingId}:${eventId}`, "booking", true],
    ["pre_webinar:1", "evergreen", false],
    ["registered_no_show:1", "evergreen", false],
    ["low_watch:1", "evergreen", false],
    ["mid_watch:1", "evergreen", false],
    ["high_watch:1", "evergreen", false],
    ["nurture:1", "marketing", false],
    ["offer_click_no_book:1", "marketing", false],
    ["booking_abandon:1", "marketing", false],
    ["live_confirmation:1", "live", false],
    ["live_reminder_day:1", "live", false],
    ["live_reminder_soon:1", "live", false],
    ["live_attended:1", "live", false],
    ["live_no_show:1", "live", false],
    ["live_replay:1", "live", false],
    ["live_rescheduled:1", "live", false],
    ["live_cancelled:1", "live", false],
    ["onboarding:999", "unknown", false],
    ["booking_future:1", "unknown", false],
    ["unknown:1", "unknown", false],
  ] as const)("classifies %s as %s and applies disabled launch defaults", (key, category, allowed) => {
    vi.stubEnv("MARKETING_EMAILS_ENABLED", "false");
    vi.stubEnv("EVERGREEN_TRAINING_ENABLED", "false");
    vi.stubEnv("LIVE_WEBINAR_ENABLED", "false");

    expect(outboundEmailDecision(key)).toMatchObject({ category, allowed });
  });

  it.each(["pre_webinar:1", "registered_no_show:1", "low_watch:1", "mid_watch:1", "high_watch:1"])(
    "keeps %s gated by evergreen training even when marketing is enabled",
    (key) => {
      vi.stubEnv("MARKETING_EMAILS_ENABLED", "true");
      vi.stubEnv("EVERGREEN_TRAINING_ENABLED", "false");
      vi.stubEnv("LIVE_WEBINAR_ENABLED", "false");
      expect(outboundEmailDecision(key)).toMatchObject({ allowed: false, reason: "training_disabled" });
    },
  );

  it.each(["nurture:1", "offer_click_no_book:1", "booking_abandon:1"])(
    "permits %s only with exact marketing opt-in",
    (key) => {
      vi.stubEnv("EVERGREEN_TRAINING_ENABLED", "false");
      vi.stubEnv("MARKETING_EMAILS_ENABLED", "TRUE");
      expect(outboundEmailDecision(key)).toMatchObject({ allowed: false, reason: "marketing_disabled" });
      vi.stubEnv("MARKETING_EMAILS_ENABLED", "true");
      expect(outboundEmailDecision(key)).toMatchObject({ allowed: true, reason: "allowed" });
    },
  );

  it("requires both evergreen and marketing approval for evergreen sequences", () => {
    vi.stubEnv("MARKETING_EMAILS_ENABLED", "true");
    vi.stubEnv("EVERGREEN_TRAINING_ENABLED", "false");
    expect(outboundEmailDecision("pre_webinar:1")).toMatchObject({ allowed: false, reason: "training_disabled" });
    vi.stubEnv("EVERGREEN_TRAINING_ENABLED", "true");
    expect(outboundEmailDecision("pre_webinar:1")).toMatchObject({ allowed: true, reason: "allowed" });
    vi.stubEnv("MARKETING_EMAILS_ENABLED", "false");
    expect(outboundEmailDecision("pre_webinar:1")).toMatchObject({ allowed: false, reason: "marketing_disabled" });
  });

  it("preserves live eligibility gating and additionally holds live marketing without marketing approval", () => {
    vi.stubEnv("LIVE_WEBINAR_ENABLED", "false");
    vi.stubEnv("MARKETING_EMAILS_ENABLED", "true");
    expect(outboundEmailDecision("live_confirmation:1")).toMatchObject({ allowed: false, reason: "live_disabled" });

    vi.stubEnv("LIVE_WEBINAR_ENABLED", "true");
    vi.stubEnv("MARKETING_EMAILS_ENABLED", "false");
    expect(outboundEmailDecision("live_confirmation:1")).toMatchObject({ allowed: true, reason: "allowed" });
    expect(outboundEmailDecision("live_replay:1")).toMatchObject({ allowed: false, reason: "marketing_disabled" });
  });
});
