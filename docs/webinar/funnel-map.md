# Vance Dotson webinar funnel — the map

Built from *The Webinar Funnel* (`pedro-webinar-ebook.pdf`). A webinar funnel is a
**belief-transformation system**, not a registration page plus a video. Its job is
to move a stranger from "I don't know you" to "look at my case", through a timed
belief shift, then adapt the follow-up to what each person actually did.

Vance's version is an **evergreen (on-demand) free training** whose conversion
action is **booking a free strategy call** — an application funnel (authority, fit,
qualification), not a paid checkout.

## The offer, in one line

> The two federal laws (FCRA and FDCPA) that stop collector harassment and challenge
> inaccurate credit reporting — even if your own disputes came back "verified".

**Named mechanism: "The Violation Ledger."** Every harassing call and every
inaccurate line, logged as what it legally is: a violation you can hold them to.
That ledger is what turns a complaint into leverage.

## The five pages (ebook §2.2)

| # | Page | Route | Its one job |
|---|------|-------|-------------|
| 1 | Registration | `/v4` (existing landing) | Curiosity → signup. Form redirects into the funnel. |
| 2 | Confirmation | `/webinar/confirmed` | The biggest show-up lever. Event importance, "watch now", reply-with-#1-goal micro-commitment. |
| 3 | Webinar room | `/webinar/room` | Hold attention, shift belief. Player fires watch events; the CTA reveals only at the pitch mark. |
| 4 | Book the call | `/webinar/call` | The offer, application-style: what the call covers, who it's for / not for, risk reversal, booking. |
| 5 | Onboarding | `/webinar/booked` | Decision momentum + "start here" checklist so the call is productive. |

All five share the `/v4` "Case File" design system and the V1/V2/V3 version toggle
(via `FunnelShell`), so the whole funnel themes coherently and can be demoed in any
of the three looks. The choice persists across every step (`localStorage v4-version`).

## The engine (ebook §4 — behavior → segment → sequence)

Behavior is captured as events, events derive a segment, the segment routes a
follow-up sequence. **Delivery is stubbed** behind a seam (`src/lib/email.ts`) — the
routing and content are real; nothing sends until a provider (e.g. Resend) is wired.

- **Event vocabulary** — `src/lib/events.ts` (one source of truth):
  `webinar_registered` → `webinar_confirmed_view` / `goal_replied` →
  `webinar_room_opened` / `webinar_watch_25|50|75|90` / `webinar_completed` →
  `offer_cta_clicked` / `call_page_view` / `call_booking_started` / **`call_booked`** /
  `call_booking_abandoned`.
- **Six segments** — `src/lib/segments.ts`: `registered_no_show`, `low_watch` (0-25%),
  `mid_watch` (25-50%), `high_watch` (50-90%), `offer_click_no_book`,
  `booking_abandon`, plus `booked` (converted).
- **Automation map** — `src/lib/automations.ts`: on registration → pre-webinar
  sequence; per segment → its own path; on booking → stop pitch, start onboarding.
- **Sequences** — `src/config/sequences.ts`: pre-webinar, long-term nurture,
  onboarding, and the six segment paths (ebook §4.4). Human-readable copy in
  [`emails.md`](./emails.md).
- **The script** — the belief ladder the room delivers, in [`script.md`](./script.md).

## Where to watch it work

`/dashboard` shows the funnel as **stages by distinct lead** (registered →
confirmation → room → 25/50/75/90 → booked) and the **six segment counts**, plus the
raw registrations + behavior feed. Walk the funnel once and the numbers move.

## Benchmarks to measure against (ebook §6.2, evergreen column)

| Stage | Healthy (evergreen) |
|-------|---------------------|
| Registration rate | 20–40% |
| Show-up (watched) | 25–45% |
| Watch-to-pitch | 25–45% |
| Offer click rate | 10–25% |
| Booked (mid-ticket equiv.) | 1–5% |

The two numbers that matter most: **earnings/registrant** and **earnings/attendee**.
For a free-call funnel, substitute *booked-calls per registrant / per attendee* and
*downstream case value*. Fix the weakest stage first; conversion is multiplicative,
not additive (ebook §5.1).

## What's real vs stubbed (flip on later)

| Real now | Stubbed behind a seam |
|----------|------------------------|
| All 5 pages + theming + toggle | Real webinar video (demo player ships) |
| Event capture + segmentation + automation routing | Email/SMS delivery (`src/lib/email.ts`) |
| Booking capture (`/api/book`) + dashboard | Real persistence (`src/lib/supabase.ts`) |
| Sequence + script content | Real calendar/booking widget (native stub) |

## Compliance guardrails (kept throughout)

No fake countdowns or timers. No guarantee %. No fabricated client faces. No em
dashes in the funnel copy. Honest urgency only (a real reason: "it's just me, so I
open a limited number of call slots each week"). `⚠️` flags remain on every
unverified claim (results, runtime, licensing, phone/office).

## Do this now (ebook back-matter, adapted)

1. Confirm one webinar **title** from `site.webinar.titleOptions`.
2. Record the training to the belief ladder in [`script.md`](./script.md); set the
   real `runtime` in `site-v3.ts` and drop the video into the room player.
3. Wire a real ESP in `src/lib/email.ts` and schedule the sequences.
4. Wire Supabase (`src/lib/supabase.ts`) so events persist across restarts.
5. Launch to warm traffic, then read `/dashboard`, find the weakest stage, fix that
   one first. Repeat weekly.
