import { describe, expect, it } from "vitest";
import { BOOKING_LIFECYCLE_EMAILS } from "./booking-email-copy";
import { SEQUENCES } from "./sequences";

const bookingCopy = [
  ...SEQUENCES.onboarding.emails,
  ...Object.values(BOOKING_LIFECYCLE_EMAILS),
];

describe("launch-eligible booking email copy", () => {
  it("contains no video, webinar, or training references or unsupported claims", () => {
    const allCopy = bookingCopy.map(({ subject, body }) => `${subject}\n${body}`).join("\n");
    expect(allCopy).not.toMatch(/\b(?:video|webinar|training|watch|recording)\b/i);
    expect(allCopy).not.toMatch(/\b(?:guarantee|guaranteed|erase|eliminate|wipe out|settle your debt|raise your score|boost your score|limited time|act now|pay now|lawsuit|legal advice)\b/i);
  });

  it("keeps booking confirmation, reminder, change, and cancellation details clear", () => {
    expect(SEQUENCES.onboarding.emails[0]).toMatchObject({
      subject: "Your call is booked. Do these 3 things first.",
      body: expect.stringContaining("{{appointment_time}} ({{timezone}})"),
    });
    expect(SEQUENCES.onboarding.emails[0].body).toContain("reschedule, reply to this email");
    expect(SEQUENCES.onboarding.emails[1].subject).toBe("Reminder: your call is coming up.");
    expect(SEQUENCES.onboarding.emails[1].body).toContain("{{appointment_time}} ({{timezone}})");
    expect(SEQUENCES.onboarding.emails[1].body).toContain("reschedule, reply to this email");
    expect(BOOKING_LIFECYCLE_EMAILS.rescheduled.body).toContain("new call time is {{appointment_time}} ({{timezone}})");
    expect(BOOKING_LIFECYCLE_EMAILS.rescheduled.body).toContain("reply to this email");
    expect(BOOKING_LIFECYCLE_EMAILS.reminder.body).toContain("{{appointment_time}} ({{timezone}})");
    expect(BOOKING_LIFECYCLE_EMAILS.cancelled.body).toContain("has been cancelled");
    expect(BOOKING_LIFECYCLE_EMAILS.cancelled.body).toContain("{{call_link}}");
  });
});
