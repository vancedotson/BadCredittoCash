import type { SequenceEmail } from "./sequences";

/** Stable template names; registration and schedule identity live on queue rows. */
export const LIVE_EMAIL_TEMPLATES: Record<string, SequenceEmail> = {
  "live_confirmation:1": {
    delay: "immediately", subject: "Your live session joining link",
    body: "You're registered for {{session_title}} with Vance Dotson on {{appointment_time}} ({{timezone}}). Join here: {{join_link}}. Add it to your calendar: {{calendar_link}}. This is general information about collector conduct, not legal advice or an individual case review. No recording is promised unless we tell you one is available.",
  },
  "live_reminder_day:1": {
    delay: "immediately", subject: "Your live session is tomorrow",
    body: "A reminder: {{session_title}} starts on {{appointment_time}} ({{timezone}}). Bring a question and any notes you want to refer to. Your joining link: {{join_link}}. Calendar details: {{calendar_link}}.",
  },
  "live_reminder_soon:1": {
    delay: "immediately", subject: "Your live session starts soon",
    body: "We're getting ready for {{session_title}} at {{appointment_time}} ({{timezone}}). Open your joining link: {{join_link}}. Arrive a few minutes early so you can get settled.",
  },
  "live_attended:1": {
    delay: "immediately", subject: "Following up after the live session",
    body: "Thanks for joining us for {{session_title}}. Keep a dated record of collector calls and save any letters, texts, or voicemails. If you'd like to discuss your own situation, you can book a free call here: {{call_link}}. No outcome is promised, and there's no obligation.",
  },
  "live_no_show:1": {
    delay: "immediately", subject: "In case you missed the live session",
    body: "In case you missed any of {{session_title}}, you can still discuss your situation on a free call with Vance: {{call_link}}. A recording isn't promised; we'll let you know separately if one becomes available. No pressure and no obligation.",
  },
  "live_replay:1": {
    delay: "immediately", subject: "The session replay is available",
    body: "The recording of {{session_title}} is now posted. Open it here: {{replay_link}}. {{replay_expiry}} The session provides general information, not legal advice. If you'd like to discuss your situation, book a free call: {{call_link}}.",
  },
  "live_rescheduled:1": {
    delay: "immediately", subject: "Your live session details have changed",
    body: "Please update your calendar: {{session_title}} is scheduled for {{appointment_time}} ({{timezone}}). Your current joining link: {{join_link}}. Updated calendar details: {{calendar_link}}.",
  },
  "live_cancelled:1": {
    delay: "immediately", subject: "Your live session has been cancelled",
    body: "{{session_title}}, originally scheduled for {{appointment_time}} ({{timezone}}), has been cancelled. Please remove it from your calendar. We're sorry for the change. There is nothing you need to do.",
  },
};

export function isLiveEmailTemplate(key: string): boolean { return Object.hasOwn(LIVE_EMAIL_TEMPLATES, key); }
export function isLiveMarketingTemplate(key: string): boolean {
  return key === "live_attended:1" || key === "live_no_show:1" || key === "live_replay:1";
}
