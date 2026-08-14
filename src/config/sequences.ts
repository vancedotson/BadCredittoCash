/**
 * Email sequence content — the three sequences plus the six behavioral segment
 * paths from the ebook (§2.3, §4.4), adapted to Vance's free-call offer (the
 * "purchase" is booking a strategy call, so "checkout abandoned" becomes
 * "started booking, didn't finish").
 *
 * This is CONTENT + STRUCTURE only. Delivery is stubbed behind src/lib/email.ts
 * (nothing actually sends yet); the automation map (src/lib/automations.ts)
 * decides which sequence a lead enters based on their segment. Copy is written
 * compliance-safe: honest urgency only (a real reason, never a fake countdown),
 * no guarantee %, no em dashes.
 *
 * ⚠️ Review with Vance before any of this is wired to a real ESP.
 */

export type SequenceEmail = {
  /** relative send time, human-readable (the scheduler reads this later) */
  delay: string;
  subject: string;
  body: string;
};

export type Sequence = {
  id: string;
  name: string;
  /** what puts a lead into this sequence */
  trigger: string;
  emails: SequenceEmail[];
};

export const SEQUENCES: Record<string, Sequence> = {
  // --- Sequence 1: pre-webinar (registration -> watch) ---------------------
  pre_webinar: {
    id: "pre_webinar",
    name: "Pre-webinar (get them to watch)",
    trigger: "On registration",
    emails: [
      {
        delay: "immediately",
        subject: "Your training is ready. Here's the link.",
        body: "You're in. This is the whole thing, start to finish. Watch it while it's in front of you: {{watch_link}}. Reply and tell me the one thing you most want fixed. I read every one.",
      },
      {
        delay: "+1 hour (if not watched)",
        subject: "The part most people need is near the end",
        body: "Quick nudge. The training is short, and the piece that matters most, what to actually do about your report, comes near the end. Don't stop early: {{watch_link}}.",
      },
      {
        delay: "+1 day (if not watched)",
        subject: "Still open: why your disputes came back verified",
        body: "If you ever disputed something yourself and it came back verified, the training explains exactly why, and what the bureaus are actually required to do instead. Your link is still open: {{watch_link}}.",
      },
      {
        delay: "+3 days (if not watched)",
        subject: "Last nudge on the training",
        body: "I'll stop after this. If the calls are still coming or there's wrong information on your report, the 35 minutes are worth it: {{watch_link}}. If now isn't the time, no problem, I'm here when it is.",
      },
    ],
  },

  // --- Sequence 3: long-term nurture (non-bookers) -------------------------
  nurture: {
    id: "nurture",
    name: "Long-term nurture (non-bookers)",
    trigger: "Watched or registered, never booked, sequences exhausted",
    emails: [
      {
        delay: "weekly",
        subject: "One thing collectors hope you never learn",
        body: "A short read on one FDCPA line collectors cross all the time, and how to tell when it happened to you.",
      },
      {
        delay: "weekly",
        subject: "A report that got cleaned up",
        body: "A quick walk through what an inaccurate item looks like, how it got challenged, and what changed. When you're ready to look at yours, the call is here: {{call_link}}.",
      },
      {
        delay: "weekly",
        subject: "Still getting the calls?",
        body: "If the calls never stopped, that's usually a sign there's a violation to hold them to. Want me to look? {{call_link}}.",
      },
    ],
  },

  // --- Post-webinar onboarding (after booking) -----------------------------
  onboarding: {
    id: "onboarding",
    name: "Onboarding (after the call is booked)",
    trigger: "On call_booked",
    emails: [
      {
        delay: "immediately",
        subject: "Your call is booked. Do these 3 things first.",
        body: "You're booked for {{appointment_time}} ({{timezone}}). Before we talk: pull your reports from all three bureaus (free at annualcreditreport.com), gather any collection letters or voicemails, and note the items you think are wrong. That's it.",
      },
      {
        delay: "1 day before",
        subject: "Talk tomorrow. Quick reminder.",
        body: "A reminder that we're scheduled for {{appointment_time}} ({{timezone}}). Have your reports and any collector messages handy and we'll get a lot further. If you need to move the time, just reply.",
      },
    ],
  },
};

/**
 * The six segment paths (ebook §4.4). Each is a short sequence keyed by segment.
 * The automation map routes a lead here by what they actually did.
 */
export const SEGMENT_SEQUENCES: Record<string, Sequence> = {
  registered_no_show: {
    id: "registered_no_show",
    name: "No-show (registered, never watched)",
    trigger: "Registered, no room_opened",
    emails: [
      { delay: "+1 day", subject: "You saved a seat but didn't watch", body: "No judgment, life happens. Your training link is still open: {{watch_link}}." },
      { delay: "+2 days", subject: "The one breakthrough people miss", body: "If you only watch one part, watch the middle: why the bureaus have to get it right, by law. {{watch_link}}." },
      { delay: "+4 days", subject: "One last nudge on your training", body: "I'll stop after this. If the calls are still coming or there's wrong information on your report, it's worth 35 minutes: {{watch_link}}." },
    ],
  },
  low_watch: {
    id: "low_watch",
    name: "Low watch (0 to 25 percent)",
    trigger: "Opened, watched under 25 percent",
    emails: [
      { delay: "+3 hours", subject: "You started, then stopped", body: "You opened the training but dropped off early. The first few minutes are just setup, the useful part is right after: {{watch_link}}." },
      { delay: "+1 day", subject: "Why the old way fails", body: "The reason DIY disputes come back verified is in minute 8. Worth the jump back: {{watch_link}}." },
    ],
  },
  mid_watch: {
    id: "mid_watch",
    name: "Mid watch (25 to 50 percent)",
    trigger: "Watched 25 to 50 percent",
    emails: [
      { delay: "+3 hours", subject: "You saw the problem. Here's the method.", body: "You got to the part where the pattern is clear. The method that fixes it, the Violation Ledger, is in the second half: {{watch_link}}." },
      { delay: "+1 day", subject: "A quick proof story", body: "A short example of what this looks like when it works, then the training picks right back up where you left off: {{watch_link}}." },
    ],
  },
  high_watch: {
    id: "high_watch",
    name: "High watch (50 to 90 percent)",
    trigger: "Watched most of it",
    emails: [
      { delay: "+1 hour", subject: "You're basically there. Want me to look?", body: "You watched most of the training, so you already see how this works. The next step is a free call where we point it at your situation: {{call_link}}." },
      { delay: "+1 day", subject: "Free, no obligation, no judgment", body: "The call's only job is to tell you whether you have a case. If you don't, I'll say so. {{call_link}}." },
      { delay: "+3 days", subject: "I open a few slots each week", body: "It's just me, so I only take a limited number of calls a week. If you want one, grab it here: {{call_link}}." },
    ],
  },
  offer_click_no_book: {
    id: "offer_click_no_book",
    name: "Clicked to book, didn't finish",
    trigger: "offer_cta_clicked, no booking",
    emails: [
      { delay: "+1 hour", subject: "Before you decide", body: "You looked at booking a call and stepped away. Totally fair. If something's holding you back, just reply and tell me, I'll answer straight." },
      { delay: "+1 day", subject: "The honest version of the call", body: "No pitch, no pressure. We look at your report and the calls, and I tell you if there's a case. That's the whole thing: {{call_link}}." },
      { delay: "+3 days", subject: "Still here when you're ready", body: "A few slots opened up this week. If now's the time: {{call_link}}." },
    ],
  },
  booking_abandon: {
    id: "booking_abandon",
    name: "Started booking, didn't finish",
    trigger: "call_booking_started, no call_booked",
    emails: [
      { delay: "+1 hour", subject: "Looks like you got interrupted", body: "You started booking a call and something pulled you away. Your spot's still here, it takes about a minute to finish: {{call_link}}." },
      { delay: "+1 day", subject: "What stopped you?", body: "If anything about the call felt unclear, reply and ask. Otherwise here's the link to finish: {{call_link}}." },
    ],
  },
};
