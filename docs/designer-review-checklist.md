# Vance Dotson design review checklist

Use this document to review and improve the product one state at a time.

- Deployed reference: `https://vance-dotson.anadias-dev.workers.dev`
- Local development: `http://localhost:3000`
- Review order: public funnel, booking, authentication, then CRM
- Feedback format: exact link + screenshot + one sentence describing the issue
- Keep visual, copy, and functional feedback separate

## Status legend

- **Ready**: the local route responds and can be reviewed.
- **Next**: the next screen we will improve.
- **Preview needed**: the route responds, but the `state` query does not yet render the named state locally.
- **Environment needed**: local Supabase configuration/authentication is required.
- **Done**: the state has been reviewed, updated, and verified.

## 1. End-to-end journeys

| ID | Step | Deployed reference | Local review | Status | Notes |
|---|---|---|---|---|---|
| F01 | Landing page | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/) | [Open local](http://localhost:3000/) | Done | Removed the blocking intro and customer-facing design switcher; locked the gold design; improved hero contrast on desktop and mobile. |
| F02 | Registration form | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/#register) | [Open local](http://localhost:3000/#register) | Done | Reduced the form to name and email, clarified that it sends the free training, improved label readability, and added focused validation coverage. |
| F03 | Confirmation and quiz | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/confirmed) | [Open local](http://localhost:3000/webinar/confirmed) | Done | Removed customer-facing design switches, shortened the confirmation copy, added clear answer selection and Continue behavior, and kept an easy skip-to-training path. |
| F04 | Training room | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room) | [Open local](http://localhost:3000/webinar/room) | Done | Removed the public placeholder label, improved player keyboard and focus controls, kept the offer hidden until the pitch, and added a clear next-step explanation before booking. |
| F05 | Webinar booking entry | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/call) | [Open local](http://localhost:3000/webinar/call) | Done | Put the form before supporting copy on phones, clarified both steps, added private/security reassurance, improved field errors and calendar labels, and made every intake answer an explicit customer choice. |
| F06 | Webinar booking confirmation | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/booked?state=booking-details) | [Open local](http://localhost:3000/webinar/booked?state=booking-details) | Done | Made the review-state link show appointment details, separated date/time/timezone, clarified calendar actions, linked the preparation resource, improved generic confirmation copy, and verified saved booking data survives the redirect. |
| D01 | Direct booking offer | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/book) | [Open local](http://localhost:3000/book) | Done | Clarified that this is a free 30-minute phone call with Vance, made the no-cost/no-obligation promise explicit, renamed step one to “Your details,” and removed the reveal delay from the critical form. |
| D02 | Direct booking calendar | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/book?state=booking-calendar) | [Open local](http://localhost:3000/book?state=booking-calendar) | Done | Made the review link open step two directly, added a clear local timezone, improved the intake heading and first question, kept every answer empty by default, verified day changes clear stale times, and replaced preview-only security errors with a neutral explanation. |
| D03 | Direct booking confirmation | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/booked?state=booking-details) | [Open local](http://localhost:3000/webinar/booked?state=booking-details) | Done | Confirmed the summary, calendar actions, and preparation checklist; added the email expectation and a clear phone action for changing the appointment. |

## 2. Registration and quiz states

| ID | State | Deployed reference | Local review | Status | Notes |
|---|---|---|---|---|---|
| R01 | Registration — normal | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/#register) | [Open local](http://localhost:3000/#register) | Done | Confirmed the short email-and-name form, clear delivery promise, and private-link reassurance; added a visible keyboard focus ring and fixed broken loading punctuation. |
| R02 | Registration — invalid fields | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/?state=registration-invalid#register) | [Open local](http://localhost:3000/?state=registration-invalid#register) | Done | Made the review link render both required-field errors immediately, kept each message beside its field, and focused the first problem for fast correction. |
| R03 | Registration — server error | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/?state=registration-error#register) | [Open local](http://localhost:3000/?state=registration-error#register) | Done | Made the review link show a clear error panel, preserved the entered name and email, kept retry available, and cleared stale server errors on the next attempt. |
| R04 | Registration — submitting | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/?state=registration-loading#register) | [Open local](http://localhost:3000/?state=registration-loading#register) | Done | Made the review link show a completed form in progress, locked fields and the button to prevent changes or double-submit, added a spinner and live status message, and kept the sending state visible on phones. |
| Q01 | Quiz — question 1 | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/confirmed?state=quiz-1) | [Open local](http://localhost:3000/webinar/confirmed?state=quiz-1) | Done | Rebuilt the answers as a proper one-choice radio group, kept every option empty by default, explained why Continue is disabled, and added a visible keyboard focus ring. |
| Q02 | Quiz — question 2 | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/confirmed?state=quiz-2) | [Open local](http://localhost:3000/webinar/confirmed?state=quiz-2) | Done | Made the review link open question two directly, kept the first answer saved for Back navigation, left question two empty, and added a clear keyboard focus ring to Back. |
| Q03 | Quiz — question 3 | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/confirmed?state=quiz-3) | [Open local](http://localhost:3000/webinar/confirmed?state=quiz-3) | Done | Made the review link open the final question with earlier answers saved, left the final answer empty, changed the guidance from Continue to open the training, and stopped review states from polluting funnel analytics. |
| Q04 | Quiz — final answer selected | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/confirmed?state=quiz-ready) | [Open local](http://localhost:3000/webinar/confirmed?state=quiz-ready) | Done | Made the review link show all three saved answers with the final choice selected, confirmed the training action is enabled, and kept the selected answer and action visible on phones. |
| Q05 | Quiz — opening training | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/confirmed?state=quiz-loading) | [Open local](http://localhost:3000/webinar/confirmed?state=quiz-loading) | Done | Made the review link show the selected final answer while opening, locked every answer and navigation control, blocked duplicate submissions, fixed the loading punctuation, and added a spinner plus live status message. |

## 3. Training and booking states

| ID | State | Deployed reference | Local review | Status | Notes |
|---|---|---|---|---|---|
| T01 | Player — idle | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room) | [Open local](http://localhost:3000/webinar/room) | Done | Removed the desktop title collision over the seek bar, added a clear start instruction and named player region, aligned the timer with the published 35-minute runtime, verified keyboard focus, and kept the booking offer hidden. |
| T02 | Player — playing | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room?state=player-playing) | [Open local](http://localhost:3000/webinar/room?state=player-playing) | Done | Made the review link start playback at an early timestamp, added a visible playing indicator, confirmed time advances and Pause is exposed, kept the booking offer hidden, and suppressed review-only analytics. |
| T03 | Player — 25% | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room?state=player-25) | [Open local](http://localhost:3000/webinar/room?state=player-25) | Done | Made the review link start at 8:45 and 25% while playback continues, added a visible percentage beside the time, kept the booking offer hidden, and suppressed milestone analytics in review mode. |
| T04 | Player — 50% | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room?state=player-50) | [Open local](http://localhost:3000/webinar/room?state=player-50) | Done | Made the review link start at 17:30 and 50% while playback continues, confirmed the progress and accessible time agree, kept the booking offer hidden, and preserved review-mode analytics suppression. |
| T05 | Player — 75% | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room?state=player-75) | [Open local](http://localhost:3000/webinar/room?state=player-75) | Done | Made the review link start at 26:15 and 75% while playback continues, confirmed the offer appears because the pitch begins at 70%, verified controls remain usable, and kept review analytics suppressed. |
| T06 | Player — 90% | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room?state=player-90) | [Open local](http://localhost:3000/webinar/room?state=player-90) | Done | Made the review link start at 31:30 and 90% while playback continues, kept the correctly timed offer visible, verified the player controls remain usable, and kept review analytics suppressed. |
| T07 | Player — completed | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room?state=player-complete) | [Open local](http://localhost:3000/webinar/room?state=player-complete) | Done | Made the review link show the true 35:00 and 100% completion state, added clear completion and replay labels, kept the offer visible, verified replay works, and kept player completion analytics suppressed. |
| T08 | Player — booking offer visible | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/room?state=offer-visible) | [Open local](http://localhost:3000/webinar/room?state=offer-visible) | Done | Made the review link pause at the exact 24:30 and 70% pitch point, showed both the next-step message and fixed booking action, verified the booking link works, and suppressed the review-only offer-click event. |
| B01 | Booking — contact error | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/book?state=booking-contact-error) | [Open local](http://localhost:3000/book?state=booking-contact-error) | Done | Made the review link show a focused invalid email with a clear red field and message, preserved the valid name and phone, let the reviewer correct the problem and continue, and blocked booking requests and review-only conversion events. |
| B02 | Booking — calendar | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/book?state=booking-calendar) | [Open local](http://localhost:3000/book?state=booking-calendar) | Done | Rechecked the calendar after the D02 improvements: day and time choices are clear, the local timezone is explicit, intake answers start empty, changing the day clears the old time, preview booking stays disabled, and desktop/mobile layouts remain clean. |
| B03 | Booking — loading | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/book?state=booking-loading) | [Open local](http://localhost:3000/book?state=booking-loading) | Done | Made the review link show a realistic selected appointment and intake while booking is in progress, added a visible and announced loading message with spinner, marked the form busy, locked every choice and action to prevent changes or repeats, and blocked real booking requests. |
| B04 | Booking — availability error | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/book?state=booking-availability-error) | [Open local](http://localhost:3000/book?state=booking-availability-error) | Done | Made the review link open the calendar with a clear announced availability failure, reassured the customer that their details are safe, added a Retry availability action, disabled stale day/time choices and confirmation, and blocked real booking requests. |
| B05 | Booking — slot taken | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/book?state=booking-error) | [Open local](http://localhost:3000/book?state=booking-error) | Done | Made the review link show a realistic slot conflict, marked the old time Booked and disabled it, explained what happened beside the calendar, focused the next available time, cleared the error after a replacement is chosen, and blocked real booking requests. |
| B06 | Confirmation — generic | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/booked?state=booking-generic) | [Open local](http://localhost:3000/webinar/booked?state=booking-generic) | Done | Rechecked the generic confirmation after the F06 improvements: it confirms success without inventing appointment details, explains that the time and call details arrive by email, gives a useful preparation checklist and urgent phone path, and stays clean on desktop and mobile. |
| B07 | Confirmation — appointment details | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/webinar/booked?state=booking-details) | [Open local](http://localhost:3000/webinar/booked?state=booking-details) | Done | Rechecked the detailed confirmation after the F06/D03 improvements: date, time, and timezone are separated clearly; Google Calendar and ICS actions work; rescheduling has a direct phone action; saved booking data survives redirects; and desktop/mobile layouts remain clean. |

## 4. Team access states

Local sign-in currently returns HTTP 500 because `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are not configured. Do not use production
account-reset actions merely to inspect visual states.

| ID | State | Deployed reference | Local review | Status | Notes |
|---|---|---|---|---|---|
| A01 | Sign in — normal | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/login) | [Open local](http://localhost:3000/login) | Done | Added clear keyboard focus, kept password-manager metadata, prevented the page from crashing when local Supabase keys are missing, showed a simple setup notice and safely disabled local submission, and fixed the Next 16 root theme-script warning exposed by this page. |
| A02 | Sign in — missing password | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/login?state=missing-password) | [Open local](http://localhost:3000/login?state=missing-password) | Done | Made the review link preserve the email, focus the empty password field, connect the red error to that field, clear the message after correction, and prevent preview authentication. |
| A03 | Sign in — invalid login | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/login?state=invalid-login) | [Open local](http://localhost:3000/login?state=invalid-login) | Done | Made the review link preserve the email while clearing and focusing the password, added a direct understandable error and visible password-reset path, and prevented preview authentication. |
| A04 | Sign in — loading | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/login?state=login-loading) | [Open local](http://localhost:3000/login?state=login-loading) | Done | Made the review link show filled credentials in progress, marked the form busy, disabled both fields and submit, added a spinner and live status message, and prevented duplicate or real preview authentication. |
| A05 | Reset request — normal | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/forgot-password) | [Open local](http://localhost:3000/forgot-password) | Done | Made the email start empty and focused, prevented a missing local Supabase setup from crashing the page, and safely disabled submission with a clear setup notice. |
| A06 | Reset request — sent | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/forgot-password?state=reset-sent) | [Open local](http://localhost:3000/forgot-password?state=reset-sent) | Done | Added a clear confirmation with the exact recipient, secure-link wording, expiry and spam-folder help, and a simple path back to sign in. |
| A07 | Reset request — error | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/forgot-password?state=reset-error) | [Open local](http://localhost:3000/forgot-password?state=reset-error) | Done | Preserved and focused the email, connected the red error to its field, cleared the message after correction, and prevented a real reset request during review. |
| A08 | Reset request — loading | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/forgot-password?state=reset-loading) | [Open local](http://localhost:3000/forgot-password?state=reset-loading) | Done | Marked the form busy, disabled its field and button, added a spinner and live progress message, and prevented duplicate or real review requests. |
| A09 | Set password — missing/too short | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/auth/update-password?state=missing-password) | [Open local](http://localhost:3000/auth/update-password?state=missing-password) | Done | Filled a too-short example, focused and marked the new-password field, connected the clear 12-character rule, and cleared the error after correction. |
| A10 | Set password — mismatch | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/auth/update-password?state=password-mismatch) | [Open local](http://localhost:3000/auth/update-password?state=password-mismatch) | Done | Filled both password fields, focused and marked confirmation as the problem, connected the mismatch message, and prevented a real review submission. |
| A11 | Set password — saving | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/auth/update-password?state=password-loading) | [Open local](http://localhost:3000/auth/update-password?state=password-loading) | Done | Marked the form busy, disabled both fields and submit, added a spinner and live secure-saving message, and prevented duplicate review submissions. |
| A12 | Set password — invalid link | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/auth/update-password?state=invalid-link) | [Open local](http://localhost:3000/auth/update-password?state=invalid-link) | Done | Replaced the endless validation dead end with an explicit expired-or-used explanation and a direct link to request a fresh reset email. |

## 5. Private CRM

These local routes require Supabase configuration and an authorized CRM user.

| ID | Area | Deployed reference | Local review | Status | Notes |
|---|---|---|---|---|---|
| C01 | Overview | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm) | [Open local](http://localhost:3000/crm) | Done | Enabled explicit local design-review data, verified the attention queue, totals, pipeline, funnel, trends, engagement, segments, sources, and recent activity on desktop and phone. |
| C02 | Contacts | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/contacts) | [Open local](http://localhost:3000/crm/contacts) | Done | Verified search, quick views, filters, summaries, import/export, responsive table/cards, and pagination; added accessible filter state, dialog semantics, and form names. |
| C03 | Pipeline | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/pipeline) | [Open local](http://localhost:3000/crm/pipeline) | Done | Verified stage totals, aging, filters, responsive stage switching, drag/drop alternatives, selection, and lost-reason capture; added specific control names and proper dialog semantics. |
| C04 | Tasks | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/tasks) | [Open local](http://localhost:3000/crm/tasks) | Done | Verified time groups, totals, filters, due/contact views, recurrence, row menus, and phone layout; added clear pressed/expanded state, task-specific action names, and accessible modal fields. |
| C05 | Activity | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/activity) | [Open local](http://localhost:3000/crm/activity) | Done | Verified summary counts, timeline groups, filters, contact grouping, details, live mode, export, load-more, and phone scanability; added safe loading/retry and non-color-only contact links. |
| C06 | Sequences | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/sequences) | [Open local](http://localhost:3000/crm/sequences) | Done | Verified queue health, the behavior-to-send flow, trigger routing, merge fields, and every email progression; made the five-step explanation use the full phone width. |
| C07 | Calendar | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/calendar) | [Open local](http://localhost:3000/crm/calendar) | Done | Booked calls, view navigation, mobile layout, and accessible calendar controls verified locally. |
| C08 | System health | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/health) | [Open local](http://localhost:3000/crm/health) | Done | Service status, actionable setup guidance, responsive layout, and contrast verified locally. |
| C09 | Settings | [Open deployed](https://vance-dotson.anadias-dev.workers.dev/crm/settings) | [Open local](http://localhost:3000/crm/settings) | Done | Integrations, notification switches, safe backup/restore, responsive layout, and accessibility verified locally. |

## Per-state completion checklist

For each row above:

- [ ] Review desktop layout.
- [ ] Review mobile layout.
- [ ] Check hierarchy and the primary action.
- [ ] Check copy, reassurance, and trust signals.
- [ ] Check keyboard access, focus, labels, contrast, and reduced motion.
- [ ] Check loading, error, empty, and success behavior where applicable.
- [ ] Implement the agreed update.
- [ ] Run focused tests and recheck the direct URL.
- [ ] Change the row status to **Done** and capture concise notes.
