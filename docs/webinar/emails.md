# The email sequences — Vance Dotson webinar funnel

Human-readable mirror of `src/config/sequences.ts` (the code the automation map
reads). Three sequences plus the six behavioral segment paths (ebook §2.3, §4.4),
adapted to the free-call offer. **Nothing sends yet** — delivery is stubbed in
`src/lib/email.ts`. Copy is compliance-safe: honest urgency only, no guarantee %, no
fake countdowns. `{{watch_link}}` / `{{call_link}}` are merge fields.

> ⚠️ Review with Vance before wiring any of this to a real ESP.

---

## Sequence 1 — Pre-webinar (registration → watch)

*Trigger: on registration. Job: get them to actually watch.*

1. **immediately** · "Your training is ready. Here's the link." — You're in, watch it
   while it's in front of you, reply with your #1 goal.
2. **+1 hour (if not watched)** · "The part most people need is near the end" — don't
   stop early.
3. **+1 day (if not watched)** · "Still open: why your disputes came back verified" —
   curiosity hook back to the link.
4. **+3 days (if not watched)** · "Last nudge on the training" — soft close, no
   pressure.

## Sequence 3 — Long-term nurture (non-bookers)

*Trigger: watched or registered, never booked, other sequences exhausted. Weekly.*

1. **weekly** · "One thing collectors hope you never learn" — value read on an FDCPA
   line.
2. **weekly** · "A report that got cleaned up" — proof + soft invite to the call.
3. **weekly** · "Still getting the calls?" — reframe: still calling = likely a
   violation.

## Onboarding — after the call is booked

*Trigger: on `call_booked`. Job: make the call productive, reduce no-shows.*

1. **immediately** · "Your call is booked. Do these 3 things first." — pull reports,
   gather letters, note wrong items.
2. **1 day before** · "Talk tomorrow. Quick reminder." — have everything handy.

---

## The six segment paths (post-webinar, routed by behavior)

The multiplier (ebook §4): the person who watched 90% and the person who watched 10%
must not get the same email.

### No-show — registered, never watched
1. **+1 day** · "You saved a seat but didn't watch" — link still open.
2. **+2 days** · "The one breakthrough people miss" — watch the middle.
3. **+4 days** · "Closing your training link soon" — honest scarcity on the link.

### Low watch (0–25%) — opened, dropped early
1. **+3 hours** · "You started, then stopped" — the useful part is right after setup.
2. **+1 day** · "Why the old way fails" — the reason is at minute 8, jump back.

### Mid watch (25–50%) — saw the problem, not the method
1. **+3 hours** · "You saw the problem. Here's the method." — the Violation Ledger is
   in the second half.
2. **+1 day** · "A quick proof story" — proof, then resume.

### High watch (50–90%) — warm, almost there
1. **+1 hour** · "You're basically there. Want me to look?" — next step is the free
   call.
2. **+1 day** · "Free, no obligation, no judgment" — the call only tells you if you
   have a case.
3. **+3 days** · "I open a few slots each week" — honest scarcity.

### Clicked to book, didn't — real intent, a blocker
1. **+1 hour** · "Before you decide" — what's holding you back? reply and ask.
2. **+1 day** · "The honest version of the call" — no pitch, no pressure.
3. **+3 days** · "Still here when you're ready" — a few slots opened this week.

### Started booking, didn't finish — friction, not objection
1. **+1 hour** · "Looks like you got interrupted" — takes about a minute to finish.
2. **+1 day** · "What stopped you?" — ask, then the link to finish.

---

## Pattern (ebook §4.4)

No-shows need **curiosity**. Low-watch needs **relevance**. High-watch needs
**urgency**, not more teaching. The abandon path stays **short** — friction kills more
bookings than objections do.
