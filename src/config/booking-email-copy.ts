import type { SequenceEmail } from "./sequences";

export const BOOKING_LIFECYCLE_EMAILS: Record<"rescheduled" | "reminder" | "cancelled", SequenceEmail> = {
  rescheduled: {
    delay: "immediately",
    subject: "Your call has been rescheduled.",
    body: "Your new call time is {{appointment_time}} ({{timezone}}). Please have your reports and any collector messages handy. If you need another change, reply to this email.",
  },
  reminder: {
    delay: "immediately",
    subject: "Reminder: your call is coming up.",
    body: "Your call is scheduled for {{appointment_time}} ({{timezone}}). Please have your reports and any collector messages handy. If you need to reschedule, reply to this email.",
  },
  cancelled: {
    delay: "immediately",
    subject: "Your call has been cancelled.",
    body: "Your call scheduled for {{appointment_time}} ({{timezone}}) has been cancelled. If you would like to choose another time, use this link: {{call_link}}.",
  },
};
