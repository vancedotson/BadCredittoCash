# Live webinar funnel — CRM tracking gaps

Historical requirements snapshot. The extension is now implemented; see [crm-implementation.md](./crm-implementation.md) for current behavior, validation, and activation steps. The notes below describe the original gaps.

What the `/live/*` pages emit, what the CRM already understands, and what still
needs adding. Written against the funnel as built (all six pages complete,
`isScheduled: false`).

Funnel: `/live` → `/live/confirmed` → `/live/room` → `/live/call` → `/live/booked`,
plus the optional `/live/replay`.

---

## Already works — nothing to do

**Source filtering.** Live registrations save with `source: "vance-live-webinar"`
(the evergreen funnel saves `"vance-webinar"`). The contacts page already has a
**Source** filter populated from real data, and the contact detail shows
`Source:`. The live funnel is separable from day one.

**Events with labels, categories and timeline icons** — already in
`src/lib/event-display.ts`:

| Event | Fired from |
| --- | --- |
| `webinar_registered` | `/live` registration → `/api/lead` |
| `webinar_confirmed_view` | `/live/confirmed` |
| `webinar_room_opened` | `/live/room` (live state) |
| `call_page_view` | `/live/call` |
| `call_booking_started` | BookingWizard, first engagement |
| `call_booked` | BookingWizard, on success |
| `call_booking_abandoned` | BookingWizard |

---

## 1. Add `live_question_asked` to the event map — highest value

**The gap that matters most.** Questions sent from `/live/room` are stored
correctly, but `src/lib/event-display.ts` has no entry for the event, so
`displayEvent()` falls through to its default: label `"live question asked"`,
category **Other**, `important: false`.

Concretely: someone types *"they keep calling my workplace after I told them to
stop"* and it lands in the timeline as low-signal noise in the Other bucket.

Add to `MAP` in `src/lib/event-display.ts`:

```ts
live_question_asked: {
  label: "Asked a question live",
  icon: "idea",
  tone: "active",
  category: "engagement",
  important: true,
},
```

**Also check:** the question text rides in the event's `props.question`. Confirm
the CRM timeline renders event props — otherwise the label shows but the actual
question does not.

---

## 2. Teach `stageFromEvents` about the live funnel

`src/lib/stages.ts` derives a contact's stage from their event names and does not
know about:

- `live_question_asked` → should mean **engaged**. It is a strong signal: they
  were in the room and participating.
- Anything from `/live/replay` → a replay watcher currently stays **new**.

Without this, someone who attended live and asked a question sits at the wrong
stage in the pipeline.

---

## 3. Segments assume recorded video — decide before the first session

**This is the one that will actively send wrong emails.**

`Segment` in `src/lib/segments.ts` is built around watch depth:
`low_watch` / `mid_watch` / `high_watch` are driven by
`webinar_watch_25/50/75/90`. **A live session never fires those** — there is no
scrubbing and no progress events.

So every live attendee falls through to `registered_no_show` or `lead`, and the
watch-depth sequences misfire: someone who sat through the entire live session
receives the "you didn't show up" email.

Options:

- Add a `live_attended` segment keyed off `webinar_room_opened` + `funnel: "live"`.
- Or gate the existing `registered_no_show` / `*_watch` sequences on `source`, so
  they only apply to evergreen contacts.

---

## 4. Sequences that do not exist yet

`src/config/sequences.ts` currently has `pre_webinar`, `nurture`, `onboarding`
plus the segment-triggered ones. The live funnel needs, at minimum:

- **The joining-link email.** `/live/confirmed` tells people the link arrives by
  email. Nothing currently sends it.
- **Reminders** — 24 hours before, and ~15 minutes before.
- **A post-session split** — attended vs. no-show.

For a live event this is worth more than any remaining page: a calendar entry
plus reminders is most of the show-up rate.

---

## 5. Smaller things

- `funnel: "live"` rides along in props on `webinar_confirmed_view`,
  `webinar_room_opened` and `call_page_view`, but **not** on the booking events —
  those come from the shared `BookingWizard`. For booking attribution by funnel,
  either add the prop there or rely on the `source` field.
- `/live/call` and `/live/booked` are deliberately ungated, so bookings can
  arrive from people who never attended. A contact who registered keeps
  `source: "vance-live-webinar"`, but a cold visitor straight to `/live/call`
  books with no source at all.

---

## Suggested order

1. **#1** — two lines, real payoff.
2. **#3** — settle before the first live session, or it sends wrong emails.
3. **#4** — the reminder emails.
4. **#2**, then **#5**.

---

## Related

- Config and copy: `src/config/live-webinar.ts`
- Components: `src/components/live-webinar/`
- Event names: `src/lib/events.ts` (`live_question_asked` is deliberately not
  prefixed `webinar_` — `tracking.ts` treats `webinar_*` as once-per-visitor
  singletons, which would drop every question after the first)
