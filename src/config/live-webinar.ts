/**
 * Content config — the LIVE webinar funnel (/live/*).
 *
 * ANGLE: this session is about debt collectors, not credit reports. The promise
 * is "know what a collector is not allowed to do, and what to do when they do
 * it" — defending yourself against collection pressure, not reading a report.
 * The FCRA/report-reading angle stays on the evergreen funnel at /webinar/*.
 *
 * Structure follows the CRO wireframe library's 06_Webinar page: topic-led hero
 * with explicit event logistics, agenda whose segments sum to the stated
 * duration, honest preparation notes, host identity without invented proof,
 * email-first registration with a time-zone selector, and explicit
 * included/not-promised boundaries.
 *
 * COMPLIANCE — every claim below traces to already-vetted copy in site-v3.ts
 * (`reframe.laws.FDCPA`, `reframe.zigzag[1]`, `meetVance`, `faq`). Three lines
 * must not be crossed when editing:
 *   1. Vance is a consumer advocate, NOT an attorney. Never imply legal advice
 *      or an attorney-client relationship. (Attorney status is an open ⚠️ item.)
 *   2. Never promise that contact stops, that a debt goes away, or any outcome.
 *      site-v3 is explicit: "Results vary and are not guaranteed."
 *   3. Never state or imply a debt is invalid. The session is about CONDUCT the
 *      FDCPA regulates, not about whether money is owed.
 *
 * ⚠️  EVERY VALUE MARKED `⚠️ PLACEHOLDER` IS NOT A REAL FACT. The live event has
 *     not been scheduled as far as this codebase knows. Replace each one with a
 *     confirmed date, platform, and agenda before /live is linked anywhere
 *     public. `isScheduled` below gates the page on exactly this.
 */

export const liveWebinar = {
  /**
   * Flip to `true` ONLY once every ⚠️ value below is a confirmed fact. While
   * false, the page renders an honest "not yet scheduled" state instead of
   * presenting placeholder logistics as a real event.
   */
  isScheduled: false,

  event: {
    /** ⚠️ PLACEHOLDER — ISO 8601 with offset. The single source of truth for every displayed time. */
    startsAt: "2026-10-08T17:00:00Z",
    /** ⚠️ PLACEHOLDER — total minutes, must equal the sum of `agenda` durations. */
    durationMinutes: 45,
    /** The zone the event is authored in; shown verbatim so the source time is never ambiguous. */
    sourceTimeZone: "UTC",
    /** ⚠️ PLACEHOLDER — where it actually streams. */
    platform: "Live video — joining link sent by email",
    /** ⚠️ PLACEHOLDER — set once seats/capacity are real. `null` = make no capacity claim. */
    capacity: null as number | null,
  },

  hero: {
    kicker: "FREE LIVE SESSION // KNOW YOUR RIGHTS",
    headlinePlain: "They're allowed to call.",
    headlineAccent: "They're not allowed to do this.",
    sub:
      "Calling your job. Calling your family. Calling at dinner, again and again. A lot of what collectors do every day crosses a line the FDCPA already drew. This is a live session on where that line is, how to document it when it's crossed, and what you can do next.",
    format: "Live session + Q&A",
    /** The three-beat panel next to the headline. */
    walkthrough: {
      label: "WHAT WE COVER",
      lines: ["The line.", "The record.", "The response."],
      terminal: "> what's illegal · how to prove it · what to do",
      caption:
        "A live teaching session using example collector conduct. No individual case is reviewed on the call.",
    },
  },

  /** Durations must sum to `event.durationMinutes`. Q&A is separate from the teaching segments. */
  agenda: [
    {
      minutes: 12,
      title: "Where the line actually is.",
      detail:
        "The specific collector conduct the FDCPA restricts — calling your workplace, discussing your debt with family or neighbors, calling at prohibited hours, threats about consequences that can't happen. You'll leave able to name what happened to you.",
    },
    {
      minutes: 12,
      title: "Build the record while it's happening.",
      detail:
        "Most people have a year of harassment and nothing written down. What to log, what to keep, and why a dated record changes the conversation entirely.",
    },
    {
      minutes: 11,
      title: "What you're entitled to ask for.",
      detail:
        "The written requests the law gives you — debt validation, and putting your contact preferences in writing — and what a collector is required to do once it's on the record.",
    },
    {
      minutes: 10,
      title: "Live Q&A.",
      detail:
        "Open questions about collector conduct and the process. General information only — this is not a review of your individual situation.",
    },
  ],

  /** Honest preparation. Nothing here promises software, documents, or personal review. */
  bring: [
    {
      title: "A rough timeline of the calls.",
      detail:
        "Even approximate — who, roughly when, how often, and whether they reached anyone besides you. It'll make the first segment land.",
    },
    {
      title: "Any letters you've kept.",
      detail:
        "Useful for following along, not required. Nothing is uploaded, read out, or shared during the session.",
    },
    {
      title: "One question.",
      detail: "The Q&A is the part most people say they needed. Come with something specific.",
    },
  ],

  host: {
    name: "Vance Dotson",
    /** Only claims already vetted in site-v3.ts. Do not add credentials that are not confirmed. */
    lines: [
      "Consumer advocate since 2004, working out of Oklahoma City.",
      "I use the FDCPA and FCRA to go after collectors and bureaus who think the rules don't apply to them.",
      "I've caught collectors breaking the law on recorded calls. This session is how to recognise it yourself.",
      "A teaching session, hosted personally. Not a sales presentation with a hidden pitch.",
    ],
  },

  /**
   * The boundary. Registrants should never infer legal representation, a
   * guaranteed outcome, or that a debt disappears.
   */
  included: [
    "A live session for the stated duration.",
    "A live Q&A segment.",
    "A joining link by email after you register.",
  ],
  notPromised: [
    "Legal advice, or an attorney-client relationship.",
    "A review of your individual case.",
    "That contact from a collector will stop.",
    "That a debt is reduced, cancelled, or goes away.",
    /** ⚠️ Delete this line ONLY if a replay is actually produced and delivered. */
    "A recording or replay.",
  ],

  faq: [
    {
      q: "Will this make the collectors stop calling?",
      a: "No session can promise that. What it can do is show you which conduct the FDCPA restricts, how to document it, and what the law entitles you to put in writing. What happens after that depends on the collector and your situation.",
    },
    {
      q: "Does this mean I don't owe the debt?",
      a: "No. This is about how a collector is allowed to behave while collecting, which is a separate question from whether money is owed. We don't cover debt validity.",
    },
    {
      q: "Is this legal advice?",
      a: "No. Vance is a consumer advocate, not an attorney, and this is general information about federal law. It isn't advice about your specific situation and no attorney-client relationship is created.",
    },
    {
      q: "Is this live, or a recording?",
      a: "Live. It runs once, at the time shown above, and the Q&A is answered in the room.",
    },
    {
      q: "Will there be a replay?",
      a: "No replay is promised. If that changes, registrants are told by email — but plan to attend live.",
    },
    {
      q: "What does it cost?",
      a: "Nothing. There is no payment step, now or to attend.",
    },
    {
      q: "How do I get the joining link?",
      a: "By email, to the address you register with. It is not shown on screen after you register.",
    },
    {
      q: "Will you look at my case on the call?",
      a: "No. It's a general session and the examples are illustrative. Individual situations are handled separately, through a free call.",
    },
  ],

  /** Section headings. Kept here so all visible copy lives in one file. */
  sections: {
    agenda: {
      kicker: "THE {DURATION}-MINUTE PLAN",
      headingLines: ["Stop guessing what's allowed.", "Start naming what isn't."],
      note:
        "The schedule adds up to {TOTAL} minutes, with the Q&A held separate from the teaching segments.",
    },
    bring: {
      kicker: "WHAT TO BRING",
      headingLines: ["You don't need a case file.", "You need one hour."],
    },
    host: {
      kicker: "THE HOST",
      headingLines: ["Hosted live by", "Vance Dotson."],
    },
    register: {
      kicker: "SAVE THE DETAILS",
      headingLines: ["Know when to join.", "Know what comes next."],
    },
    boundaries: {
      kicker: "FORMAT AND FOLLOW-THROUGH",
      headingLines: ["A live session.", "No surprise assumptions."],
    },
    faq: {
      kicker: "THE PRACTICAL DETAILS",
      headingLines: ["A few things", "worth knowing."],
      note: "Clear answers before you decide.",
    },
  },

  registration: {
    heading: "Save your seat.",
    /**
     * Kept in step with RegistrationFormV3, which asks for name + email (phone
     * is off). If that form ever drops the name field, say "email is all that's
     * needed" here — but never before.
     */
    sub: "Your name and email, nothing else. The joining link arrives by email.",
    submitLabel: "Save my seat",
    loadingLabel: "Saving your seat...",
    reassurance:
      "Free. No payment. Your joining link arrives by email — no spam, unsubscribe anytime.",
  },

  finalCta: {
    heading: "You're not the problem here.",
    sub: "Come find out what they're not allowed to do.",
  },

  /**
   * /live/confirmed — step 2, and the single biggest lever on show-up rate.
   * A registration is only worth something if the person is there at one
   * specific moment, so every block here exists to get them into the room.
   *
   * Wireframe CRO map §07: the confirmation explains link delivery without
   * claiming a seat or an email that does not exist. Say what was actually
   * done, never more.
   */
  confirmed: {
    /** register → confirmed → room → call → booked. Five steps, not four. */
    kicker: "STEP 2 OF 5 // YOU'RE REGISTERED",
    heading: "Your seat is saved.",
    sub: "Now do the one thing that decides whether you actually make it: put it on your calendar before you close this tab.",

    calendar: {
      label: "ADD IT TO YOUR CALENDAR",
      note: "Most people who miss a live session didn't change their mind — it just left their head. Ninety seconds now is the whole difference.",
      googleLabel: "Add to Google Calendar",
      icsLabel: "Apple / Outlook (.ics)",
      /** Shown on the calendar entry itself. */
      eventTitle: "Live session with Vance Dotson — collector rights",
      eventDescription:
        "Free live session on what debt collectors are not allowed to do under the FDCPA, how to document it, and what you're entitled to ask for. The joining link is sent by email.",
    },

    /** What happens next, stated as fact. Nothing here promises what wasn't done. */
    nextUp: {
      label: "WHERE YOUR LINK COMES FROM",
      steps: [
        {
          title: "Check your inbox now.",
          detail:
            "A confirmation is on its way to the address you just used. If it isn't there in a few minutes, look in spam or promotions — and mark it 'not spam' so the joining link doesn't land there too.",
        },
        {
          title: "The joining link arrives by email.",
          detail:
            "It is not shown on this page. Keep the confirmation email — that's the thread the link comes in on.",
        },
        {
          title: "Join a few minutes early.",
          detail:
            "It starts on time and runs once. Arriving late means missing the segment most people came for.",
        },
      ],
    },

    /** Restated so nobody skips the live session expecting to catch up later. */
    boundary: {
      label: "SO THERE'S NO CONFUSION",
      lines: [
        "This runs live, once, at the time above.",
        "No recording or replay is promised.",
        "It's general information about federal law — not legal advice, and not a review of your case.",
      ],
    },

    countdown: {
      label: "STARTS IN",
      live: "Happening now — check your email for the joining link.",
      ended: "This session has ended.",
      endedSub: "Watch the on-demand training, or book a free call.",
    },
  },

  /**
   * /live/replay — optional. A recording for no-shows and late registrants.
   *
   * IMPORTANT: `isPublished` is the switch for the whole funnel's replay
   * promise, not just this page. While it is false, /live and /live/confirmed
   * keep saying no replay is promised and this page says the session isn't
   * posted — which is the honest state when no recording exists. Setting it to
   * true removes those disclaimers everywhere automatically (see
   * `notPromisedLines()` and `boundaryLines()` below), so the site never
   * promises a replay it doesn't have, or denies one it does.
   *
   * Never set this true before the recording is actually up at `embedUrl`.
   */
  replay: {
    isPublished: false,

    /** ⚠️ PLACEHOLDER — the recording's player URL. Its origin is added to CSP frame-src. */
    embedUrl: null as string | null,

    /**
     * ISO 8601, or null for no stated expiry. When set, the page shows the
     * deadline and stops playing after it — so a "48 hours only" claim is
     * enforced by the page rather than just asserted in copy.
     */
    availableUntil: null as string | null,

    kicker: "REPLAY // LIMITED TIME",
    heading: "Watch the replay.",
    sub: "The full session — where the line is, how to document it, and what you're entitled to ask for.",
    expiryLabel: "AVAILABLE UNTIL",
    expiredKicker: "REPLAY CLOSED",
    expiredHeading: "The replay window has closed.",
    expiredSub:
      "This recording is no longer posted. The on-demand training covers the same ground, and a free call is open if you want your own situation looked at.",

    /** Shown while `isPublished` is false. Says plainly that none exists. */
    unavailable: {
      kicker: "NO REPLAY POSTED",
      heading: "There's no recording of this one.",
      sub: "The session runs live and isn't recorded. The on-demand training covers the same material and you can watch it right now.",
    },

    cta: {
      heading: "Want your own situation looked at?",
      sub: "The replay is general information. A free call is where the specifics get discussed.",
      buttonLabel: "Book my free call",
      href: "/live/call",
    },
  },

  /**
   * /live/call — step 4. The offer, taken straight off the live session.
   *
   * Voice picks up where the session left off: you now know what they're not
   * allowed to do, and the call is where your own situation gets looked at.
   * Every claim traces to vetted copy in site-v3.ts (`riskReversal`, `faq`,
   * `howItWorks`). No outcome is promised and no legal advice is implied.
   */
  call: {
    kicker: "SCHEDULE // STRATEGY CALL",
    heading: "Now let's look at yours.",
    body:
      "The session was general — this is the part where someone actually looks at what's happening to you. A free 30-minute call with Vance: what the collectors have been doing, what's on your report, and the honest next step. No cost, no obligation.",

    /** What the call covers. Mirrors site-v3 `howItWorks`, in the live voice. */
    covers: [
      "You walk through what the collectors have actually been doing.",
      "Vance says whether there looks to be a violation worth holding them to.",
      "You leave knowing where you stand — either way, and with no pressure.",
    ],

    facts: ["30 minutes", "By phone", "Directly with Vance", "Free, no obligation"],

    /** The honest floor. Straight from site-v3 `riskReversal`. */
    reassurance: [
      "The call is free.",
      "No judgment. Vance has seen it all.",
      "No obligation.",
      "Worst case: you learn exactly where you stand.",
    ],

    /** Shown to someone who lands here without having been in the session. */
    note: "Didn't catch the live session? The call is open either way.",
  },

  /**
   * /live/booked — step 5. Post-booking onboarding.
   *
   * Two jobs: confirm what was actually booked, and make the call productive.
   * The checklist is the collector-angle version of site-v3's `webinar.booked`
   * checklist — it asks for the call record, because that's what the session
   * taught people to build and what the call will actually work from.
   */
  booked: {
    kicker: "CONFIRMED // CALL BOOKED",
    heading: "Your call is booked.",
    /** Used when the booking details survived the handoff. */
    body: "Here's what you booked. Add it to your calendar, then spend ten minutes on the list below — it's the difference between a vague call and a useful one.",
    /** Used when sessionStorage was unavailable and we have no details to show. */
    bodyGeneric:
      "You're confirmed. Check your email for the appointment time and call details, then use the checklist below.",

    appointmentLabel: "Your 30-minute call",
    calendarNote: "Vance calls you at this time. If you need to move it, reply to the confirmation email.",

    checklist: {
      label: "BEFORE THE CALL",
      items: [
        {
          text: "Write down the collector calls you can remember — who, roughly when, how often, and whether they reached anyone else.",
        },
        {
          text: "Gather any collection letters, texts, or voicemails you still have.",
        },
        {
          text: "Pull your credit reports from all three bureaus, free, at",
          linkLabel: "AnnualCreditReport.com",
          href: "https://www.annualcreditreport.com/",
        },
        {
          text: "Note anything on those reports you think is wrong or isn't yours.",
        },
      ],
      note: "None of this is required — come as you are. It just means less of the call spent reconstructing dates.",
    },

    /** The honest in-crisis path. Matches site-v3 contact details exactly. */
    urgent: {
      label: "IF IT CAN'T WAIT",
      body: "If a collector is threatening you or something is moving fast, call the office rather than waiting for the appointment.",
    },
  },

  /**
   * /live/room — step 3. The session itself: a video area and a way to send
   * Vance a question. Deliberately sparse; nothing competes with the stream.
   */
  room: {
    /**
     * ⚠️ PLACEHOLDER — the player embed URL (YouTube/Vimeo/StreamYard/etc).
     * `null` renders an honest "stream not connected" panel instead of a broken
     * black box.
     *
     * IMPORTANT: the origin of whatever you put here is added to the page's
     * Content-Security-Policy `frame-src` automatically (see middleware.ts).
     * Without that the browser blocks the iframe silently — no console error
     * that most people would notice, just an empty rectangle.
     */
    embedUrl: null as string | null,

    /** How early the room lets people in before the session starts. */
    doorsOpenMinutes: 15,

    heading: "The live session.",
    stagePlaceholder: {
      label: "STREAM NOT CONNECTED",
      body: "The player embed hasn't been set yet. Add the stream URL to `room.embedUrl` in src/config/live-webinar.ts and it appears here.",
    },

    /** States either side of the session. */
    early: {
      kicker: "THE ROOM ISN'T OPEN YET",
      heading: "You're early.",
      sub: "The room opens shortly before we start. Leave this tab open — it lets you in on its own, no refresh needed.",
    },
    ended: {
      kicker: "SESSION ENDED",
      heading: "That's a wrap.",
      sub: "The live session is over. No replay was promised and none is posted — but the on-demand training is there, and a free call is open if you want to talk about your own situation.",
      /** Used instead of `sub` when `replay.isPublished` is true. */
      subWithReplay:
        "The live session is over. The recording is up for a limited time — watch it below, or book a free call if you want your own situation looked at.",
    },

    /**
     * One-way question box, NOT a public chat. On a session about debt and
     * collectors, a public room invites people to post account numbers,
     * balances and employer names in front of strangers. Questions go to Vance
     * only, land on the contact's CRM timeline, and are never shown to others.
     */
    qa: {
      label: "ASK VANCE A QUESTION",
      placeholder: "What do you want to ask about your situation?",
      submitLabel: "Send to Vance",
      sendingLabel: "Sending...",
      sentLabel: "Sent",
      note: "Questions go only to Vance — nobody else in the session sees them. He answers as many as time allows in the Q&A segment. Please don't include account numbers or anything you wouldn't want written down.",
      emptyState: "No questions sent yet.",
      sentHeading: "Your questions",
      errorText: "That didn't send. Try again in a moment.",
      maxLength: 1000,
    },

    /**
     * Only used by the ended state — there is deliberately no offer on screen
     * during the session itself. Without these the room would be a dead end
     * once the session is over.
     */
    cta: {
      buttonLabel: "Book my free call",
      href: "/live/call",
    },
  },

  ctaLabel: "Save my seat",
} as const;

/** Total of the agenda segments — used to assert the schedule matches the stated duration. */
export const agendaTotalMinutes = liveWebinar.agenda.reduce((sum, s) => sum + s.minutes, 0);

/* -------------------------------------------------------------- replay seam */

/**
 * The replay disclaimers are derived, never hand-maintained in three places.
 * `replay.isPublished` is the single switch: while it's false the site says no
 * replay is promised; when it's true those lines disappear on their own. This
 * exists so nobody has to remember to edit /live, /live/confirmed and
 * /live/room when a recording goes up or comes down.
 */
const REPLAY_NOT_PROMISED = "A recording or replay.";
const REPLAY_NOT_PROMISED_BOUNDARY = "No recording or replay is promised.";

/** The /live "Not promised" column. */
export function notPromisedLines(): readonly string[] {
  const lines = liveWebinar.notPromised as readonly string[];
  return liveWebinar.replay.isPublished ? lines.filter((l) => l !== REPLAY_NOT_PROMISED) : lines;
}

/** The /live/confirmed "So there's no confusion" list. */
export function boundaryLines(): readonly string[] {
  const lines = liveWebinar.confirmed.boundary.lines as readonly string[];
  return liveWebinar.replay.isPublished
    ? lines.filter((l) => l !== REPLAY_NOT_PROMISED_BOUNDARY)
    : lines;
}

/** The /live FAQ, with the replay answer swapped to match reality. */
export function faqItems(): ReadonlyArray<{ q: string; a: string }> {
  return liveWebinar.faq.map((item) =>
    liveWebinar.replay.isPublished && item.q === "Will there be a replay?"
      ? {
          q: item.q,
          a: "Yes — a recording is posted after the session and registrants are emailed the link. Attending live is still worth it: the Q&A is answered in the room.",
        }
      : item,
  );
}

/** True when a replay exists AND its stated window hasn't passed. */
export function replayIsWatchable(now: number = Date.now()): boolean {
  if (!liveWebinar.replay.isPublished) return false;
  const until = liveWebinar.replay.availableUntil;
  if (!until) return true;
  const deadline = new Date(until).getTime();
  return Number.isNaN(deadline) ? true : now < deadline;
}
