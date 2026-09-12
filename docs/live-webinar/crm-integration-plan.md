# Live webinar CRM integration plan

Implementation follow-through: [crm-implementation.md](./crm-implementation.md) documents the completed extension and the gated activation sequence. This plan remains the original review record.

Prepared September 12, 2026, against the current workspace implementation and checked-in Supabase migrations.

**Recommendation:** extend the existing CRM with session-specific webinar participation and automation. Reuse its contacts, activity history, email delivery, booking, and calendar systems. Introduce live behavior in independently gated releases, with existing evergreen behavior covered by regression tests.

**Confirmed requirement:** support repeated live sessions, including the same person registering for more than one session.

This is an analysis and implementation plan. No application code, database, customer records, email queue, or deployment was changed for this review. Production database function definitions and actual customer enrollment counts were not inspected; those must be checked before rollout. The existing uncommitted live-funnel work is part of the reviewed baseline.

## 1. What the current implementation actually does

The source guideline identifies useful features, but several assumptions differ from the code.

| Area | Verified behavior | Consequence for implementation |
| --- | --- | --- |
| Registration email | `/api/lead` always builds and immediately attempts `pre_webinar`; its SQL transaction also hardcodes that sequence. Email links resolve to `/webinar/room` and `/book`. | Live registration can send the evergreen training email. Adding a live template alone cannot fix the routing. |
| Live attendance segmentation | Both `deriveSegment()` and the tracking API map `webinar_room_opened` to `low_watch`. The API ignores `funnel` when selecting a sequence. | A live room visitor can receive the "You started, then stopped" email. This is more immediate than the guideline's predicted no-show problem. |
| Questions | TypeScript accepts `live_question_asked`, but the latest checked-in `record_funnel_event` SQL allowlist does not. The client reports success immediately; tracking errors are swallowed. | Question persistence must be fixed and verified before treating this as a display-only change. An apparently successful submission is not proof of storage. |
| Question display | Neither contact Timeline nor Activity Feed renders `props.question`. Expanded activity groups also omit each item's detail. | Add the label and readable contents in both views, including multiple questions. |
| Pipeline stage | Room entry already derives `engaged`. Questions do not. A valid saved stage takes precedence, and the database defaults contacts to `new`. | Editing `stageFromEvents()` alone will not promote most persisted contacts. Preserve sales decisions and explicitly define automatic stage ownership. |
| Source filter | The CRM prefers `utm_source` over `contact.source`. Re-registration overwrites `contact.source`. | A Facebook live lead may appear under Facebook, and one source cannot represent multiple registrations. Add separate Funnel and Session filters. |
| Repeat registration | Registration event IDs are `registration:<contactId>`. Enrollment uniqueness is contact + sequence, without a session. Browser singleton IDs also omit funnel/session. | Different sessions can collapse together, block one another, or reuse an old email enrollment. |
| Room entry | The event can fire during the 15-minute doors-open period and when the embed is missing. | It establishes room entry, not actual playback or full-session attendance. |
| Replay | The replay is an iframe with no dedicated playback tracking. | Adding a stage rule cannot identify replay watchers. Instrument replay entry separately from proven playback. |
| Booking | `call_booked` is recorded by the server. The shared wizard emits booking-start events but does not currently emit abandonment. A cold booking has source `booking`. | Preserve the authoritative server booking event; add optional live attribution throughout the request. Do not rely on a nonexistent abandonment emitter. |
| Live scheduling | No live joining/reminder/post-session workflow exists. Google Calendar and ICS downloads already exist on the live confirmation page. | Reuse calendar generation, but supply durable session details and correct joining links. |

Primary code references:

- [Registration API](C:/Users/p-bur/Clientes/Vance/src/app/api/lead/route.ts:94), [atomic registration RPC](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260811190000_atomic_registration_enrollment.sql:38), [email link rendering](C:/Users/p-bur/Clientes/Vance/src/lib/email.ts:90).
- [Tracking routing](C:/Users/p-bur/Clientes/Vance/src/app/api/track/route.ts:14), [segment derivation](C:/Users/p-bur/Clientes/Vance/src/lib/segments.ts:46), [database event allowlist](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260813133000_funnel_error_event.sql:17).
- [Question submission](C:/Users/p-bur/Clientes/Vance/src/components/live-webinar/LiveRoomSection.tsx:92), [Timeline details](C:/Users/p-bur/Clientes/Vance/src/components/crm/Timeline.tsx:10), [Activity details](C:/Users/p-bur/Clientes/Vance/src/components/crm/ActivityFeed.tsx:30).
- [Stage rules](C:/Users/p-bur/Clientes/Vance/src/lib/stages.ts:75), [stored-stage precedence](C:/Users/p-bur/Clientes/Vance/src/lib/store.ts:828), [database contact search](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260811143000_database_contact_search.sql:30).
- [Re-registration and event identity](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260807170000_lead_attribution_consent.sql:47), [browser event identity](C:/Users/p-bur/Clientes/Vance/src/lib/tracking.ts:45), [booking creation](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260801213000_public_booking.sql:33).

## 2. Recommended design

### Keep sales status and webinar participation separate

A contact remains one person in the existing CRM. Their sales stage remains `new`, `registered`, `engaged`, `booked`, `won`, or `lost`. Each live session gets its own registration and participation history.

For example, one contact can be a Client, have attended September's webinar, and be registered for October's webinar. October's reminders use October's registration, while their Client stage remains intact.

Add two tables, with final names following repository conventions:

| Record | Minimum information |
| --- | --- |
| `live_webinar_sessions` | Stable ID and slug, title, start/end in UTC, authored timezone, lifecycle status, joining/player configuration, replay publication/expiry, schedule version, live automation enabled flag. |
| `live_webinar_registrations` | Contact ID, session ID, registered timestamp, registration attribution/timezone, first room entry, participation evidence, cancellation state, post-session outcome, and processing timestamps. Unique `(contact_id, session_id)`. |

Use server-validated session IDs in live events, booking attribution, links, and email payloads. Treat a postponed session as the same ID with a new schedule version; a newly repeated event gets a new ID.

Preserve existing contact source and first-touch attribution when the new live path finds an existing contact. Save live registration attribution on its registration record. Keep legacy registration behavior stable until a separate attribution change is deliberately undertaken. This does not make the existing source field immutable: a subsequent evergreen registration can still change it. Session membership must never depend on that mutable field.

Use the session record as the authority for logistics. Keep reusable marketing copy in `src/config/live-webinar.ts`. Existing `/live/*` routes can resolve the current session when no session is specified; confirmation, joining, replay, and email links must explicitly retain the intended session so old links never silently switch to a later event. Provide a small CRM session-management screen to create, schedule, postpone, cancel, and publish a replay using existing team authorization and audit logging.

### Add live classification without changing evergreen meanings

Use a session-specific classifier with states such as Registered/upcoming, Entered room, Participated, No attendance recorded, and Replay opened. Store timestamps/evidence and derive the display state; retain attendance and replay as separate facts so replay viewing does not erase the live-session outcome.

Keep the existing watch-depth segments for evergreen activity. Live events must not enter `low_watch`, `mid_watch`, `high_watch`, or the evergreen no-show sequence. Update both TypeScript routing and SQL send-eligibility predicates: a live room event must not inadvertently stop an unrelated evergreen email simply because it shares an event name.

Default post-session rule: count a linked participant with in-session presence or an accepted in-session question as attended. An early room entry alone remains "Entered room" unless presence is observed during the session. If the eventual player cannot verify playback, label the evidence honestly and use neutral follow-up copy such as "In case you missed any of it." Only finalize "No attendance recorded" after the session ends and a short configurable ingestion grace period. Never claim a person watched the entire event from a page visit.

### Reuse email delivery with explicit session context

Keep the existing queue, provider delivery, message claiming, retries, delivery receipts, and operator controls. Add a session context to enrollments rather than calling the current global sequence-ranking function unchanged.

Recommended migration shape: add a non-null context key defaulting to `legacy`, plus a nullable live registration reference. Live context is deterministic for each registration, not an arbitrary caller-supplied key. Replace contact/sequence uniqueness with contact/sequence/context uniqueness. In the same migration transaction, update legacy RPC conflict targets to `(contact_id, sequence_key, context_key)` and restrict their progression to legacy context while preserving their signatures. Introduce a versioned live registration/enqueue RPC that requires registration context. Database checks must tie together the context key, registration, and contact so alternate context strings cannot create duplicate enrollments.

This is a controlled compatibility change: every enrollment writer, cancellation path, completion handler, sequence reader, and restore path must be checked. Legacy calls retain their old inputs and results. New live progression is scoped to one registration; booking suppression is deliberately applied to promotional messages across contexts, without cancelling requested webinar logistics or booking confirmations.

Add an immutable `delivery_key` to scheduled messages containing registration, message kind, and schedule version where appropriate. Backfill legacy delivery keys from existing template keys and replace message uniqueness with `(enrollment_id, delivery_key)`, updating all enqueue/booking conflict writers in the same migration transaction. Preserve existing row IDs, delivery metadata, and template keys. Retrying a registration or cron must not reset a sent message to scheduled. Preserve the queue message ID across provider retries. Treat an intentional resend as a separate audited operation. Keep `template_key` as the renderer's template identity rather than embedding new live-session context in it.

Live immediate delivery must claim the exact committed message ID or registration/delivery key. The current `claim_scheduled_email(email, template_key)` becomes ambiguous when the same person has the same template in two sessions; retain that signature for legacy callers, restrict it to legacy context, and introduce an explicit live claim path. Due-batch claims can continue returning unique message IDs with the required context/payload.

Relevant existing constraints: [queue uniqueness](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260802150000_durable_email_queue.sql:1), [global progression/cancellation and upsert](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260809220000_booking_email_lifecycle.sql:21), [send eligibility](C:/Users/p-bur/Clientes/Vance/supabase/migrations/20260809180000_email_send_eligibility.sql:21).

## 3. Implementation order and acceptance gates

### Phase 0 — Establish the baseline and contain routing risk

- Snapshot the current working changes and verify the actual deployed migration/function versions before implementation. Count existing live-tagged registrations and associated queued messages without changing customer records.
- Keep public scheduling and live automation disabled until the required paths are verified. `isScheduled: false` is currently a presentation gate; add server checks so previews and forged requests cannot enroll a placeholder event.
- First contain the shared registration/tracking paths: recognized live requests must use the live path, or fail clearly while it is disabled. They must never fall back into evergreen enrollment. Unknown session context must not silently become evergreen.
- Make preview submission and tracking explicitly inert. The current `internal=1` tracking preference does not itself prevent registration writes.
- If misrouted live messages already exist, produce a scoped dry-run list, then pause/cancel only confirmed incorrect pending messages. Preserve sent history and real evergreen enrollments. Do not enroll historical contacts into new messages as a side effect of the migration.

Acceptance: an unscheduled/preview live registration cannot send email; an evergreen registration still behaves as before.

### Phase 1 — Introduce sessions and atomic live registration

- Add session/registration tables, indexes, existing-role RLS, and server-only write functions. Add backup, privacy export, deletion, and restore support with the schema, rather than as a later cleanup.
- Extend the shared registration form with optional live context. Existing callers keep their defaults. `/api/lead` resolves a real published session server-side and selects the live RPC.
- Atomically save the contact association, session registration, consent evidence, registration event, and durable joining-email intent. Provider delivery remains outside the database transaction and is retryable.
- Preserve contact deduplication, visitor association, existing consent/suppression, team ownership, contact trash/privacy rules, and first-touch attribution. Do not blindly call the old registration function if its source overwrite and lifetime event key would destroy session semantics.
- Add the minimal CRM session-management view. Reuse the current calendar/ICS controls and render the same session version everywhere.

Acceptance: the same email registering twice for session A has one registration and one initial joining-email intent; registering for session B creates a separate registration and message without a duplicate contact.

### Phase 2 — Persist and display useful live activity

- Add live event vocabulary and required properties consistently to TypeScript validation and the database allowlist. Keep server-only conversion/registration events protected as today.
- Scope shared live singleton IDs by funnel + session + identity, while leaving existing evergreen IDs compatible. Give each question a distinct submission ID and reuse that ID on retry.
- Use an acknowledged question endpoint/helper that validates session, bounded question text, and participant association, and returns success only after durable persistence. Keep normal analytics fire-and-forget. On failure, retain the question and offer retry.
- Attach `funnel: "live"`, session ID, and participant context to questions, room/confirmation views, and live booking-start events. Avoid sending question contents into the general analytics `dataLayer`; only CRM persistence needs the text.
- Add the requested important engagement label/icon to `event-display.ts`. Share safe event-detail formatting between Timeline and Activity Feed. Display every question in expanded groups, with session and timestamp; group by session as well as person/event/date.
- Resolve emailed joining links across devices using an opaque, revocable registration token exchanged server-side for scoped participation context. Do not put raw email addresses into links or depend exclusively on `localStorage`. Tokens must not authorize CRM access, appear in analytics URLs, or be logged with question contents. Remove the token from the visible URL before analytics runs.
- Use contact ID consistently in CRM event reads or normalize resolved identities: the current visitor-based RPC can assign `contact_id` while leaving `email` null, but several CRM aggregations group by email.
- Track replay availability/opening explicitly; track playback only after adding the chosen player's verified playback hooks. A replay page open can be shown as activity without claiming a watch-depth milestone.

Acceptance: two different questions appear in both CRM views; retrying one question does not duplicate it; failed persistence never shows success. A join from a new browser links to the correct session registration. Early entry, preview, unavailable embeds, and expired replays do not fabricate attendance.

### Phase 3 — Schedule live emails safely

| Message | Timing | Rules |
| --- | --- | --- |
| Joining confirmation | Immediately after successful registration | Session title, correct localized date/time, joining link, and calendar links. Registration success requires a durable email intent, not successful synchronous provider delivery. |
| Day-before reminder | Session start minus 24 hours | Skip if registration happens after this time. |
| Starting-soon reminder | Approximately session start minus 15 minutes | Skip if already stale; define a send deadline so delayed jobs do not send it after the session starts. |
| Post-session attended branch | End plus ingestion grace period | One branch per registration, based on that session's evidence; recheck before claim. |
| Post-session no-attendance branch | Same window | Neutral copy; never inferred from lifetime watch depth or before the session ends. |
| Replay availability | Only when a recording is published and accessible | Do not promise a recording when none exists; honor expiry at send time. |
| Schedule change/cancellation | When an operator changes a published session | Cancel stale pending reminders, increment schedule version, and issue one appropriate update per registration. |

- Build live absolute schedules separately from the legacy `scheduledFor()` parser. It currently supports appointment reminders and clamps a past reminder to now; reusing that behavior would bunch stale live reminders together.
- Separate requested webinar logistics from promotional follow-up in both SQL eligibility and TypeScript template handling. Preserve universal suppression, bounce/complaint and privacy controls. Promotional follow-up requires existing marketing eligibility; a new webinar registration must not silently clear an unsubscribe/suppression state.
- Do not let a historic `call_booked` block requested joining details for a newly registered webinar. Continue stopping promotional booking pitches when the existing booking/client policy requires it. Preserve appointment onboarding, rescheduling, cancellation, reminders, and calendar synchronization.
- Extend cancellation/unsubscribe handlers and operator pause/retry controls to respect the new contexts. Recheck session status, schedule version, expiry, suppression, and branch eligibility at claim time and immediately before provider dispatch, not only enqueue time. Document the race for an already in-flight provider request: cancellation cannot retract a message already accepted for delivery, and its history must be preserved.
- Add live due-work processing to the existing maintenance entry point without coupling its success to calendar/retention jobs. Use atomic claims/locks and durable deduplication for overlapping cron runs.
- Capacity-test synchronized reminders. The current worker invokes maintenance every five minutes and processes only ten emails per call. Add bounded draining or a suitable job cadence/concurrency with provider pacing and queue-lag monitoring. Test at the agreed maximum audience size; a single ten-email batch cannot serve a large cohort near one deadline.

Acceptance: correct session links and times, skipped expired reminders, one post-session branch, no duplicate sends under retry/concurrency, no unsolicited marketing to ineligible contacts, and no impact on booking emails.

### Phase 4 — Expose participation, attribution, and safe stage behavior in the CRM

- Add independent Funnel and Session filters to Contacts and Activity, and a session-participation section on each contact. Preserve existing Source filtering and source reports.
- Show session registration, room entry/attendance evidence, questions, replay activity, booking attribution, and queued/sent/failed messages. Make the chosen session visible in sequence operations.
- Add session counts for registrations, attendance evidence, no attendance recorded, replay opens, and attributed bookings. Use a distinct-registration denominator rather than lifetime contacts; keep current evergreen funnel metrics stable. Update SQL aggregations as well as TypeScript/demo readers.
- Extend the database-backed contact search with explicit session predicates; it independently duplicates segment logic, so client-side filters alone are insufficient. Review cooling/no-follow-up and high-intent notifications for the same distinction. If questions create an alert, deduplicate it by contact and session rather than sending an alert for every question or suppressing all future sessions after the first.
- Add `live_question_asked` and actual replay-playback events to stage fallback derivation, keeping `booked` precedence. Do not classify a page open as proven playback.
- To meet automatic promotion requirements safely, add explicit stage provenance/mode. New contacts created through the live path can opt into automatic advancement; manual CRM edits switch that contact to manual. Existing contacts remain under their stored stage unless provenance proves automation is safe. Never bulk reinterpret all `new` contacts as automatic or overwrite `won`/`lost`.
- Normalize the existing legacy stored `call_booked` stage to the canonical display meaning `booked` consistently in Contacts, detail, and Pipeline adapters, without regressing established bookings or rewriting customer decisions. Keep any historical cleanup separate and previewable.
- Add optional funnel/session context to BookingWizard, `/api/book`, and the server booking RPC. Preserve slot conflict handling and calendar operations. Store attribution on the actual booking/server event, not just a browser event. A direct `/live/call` booking need not be a webinar registration or count as attendance.
- Derive booking abandonment only after a defined inactivity window with no completed booking for that attempt/context. Do not depend on tab-close events or immediately label the first booking interaction abandoned in the live UI.

Acceptance: the same contact can show different outcomes for two sessions while keeping the correct sales stage. A live booking is attributed even without prior registration. Evergreen reports and current contact/source filters remain consistent.

## 4. Regression and rollout plan

### Required test matrix

| Scenario | Expected result |
| --- | --- |
| Existing evergreen registration, watch milestones, offer, booking | Same messages, segment progression, and booking/calendar results as the baseline. |
| Evergreen then live, and live then evergreen, in one browser | Both histories survive; live activity cannot trigger evergreen watch-depth follow-up. |
| Duplicate registration and simultaneous retries | One contact/session registration and one logical joining message. |
| Same contact in two sessions, including overlapping enrollment | Independent attendance, reminders, and links; no cross-session cancellation. |
| Two questions, repeated submission ID, malformed question, database failure | Correct contents, idempotency, validation, and honest error state. |
| New browser, absent browser storage, visitor later associated with contact | Correct identity or explicit unlinked status; no guessed contact assignment. |
| Early room entry, live presence, no-show, late telemetry | Evidence-based outcome, finalized after end, with no stale contradictory branch. |
| Replay unpublished, published, expired, opened, actually played | Only supported events and claims; no inferred watch depth from page entry. |
| Late registration; timezone/DST; postpone/cancel; expired queue item | Correct absolute times; stale reminders skipped/cancelled; one schedule update. |
| Duplicate cron, provider retry, send/ack interruption | Atomic claims, stable message IDs, and no logical resend caused by re-enrollment. |
| No marketing consent, unsubscribed, suppressed, bounced, trashed contact | Existing controls respected in enqueue, claim, delivery, and operator retry. |
| Existing booked/client/lost/manual-stage contact registers | Stored sales decision preserved; appropriate requested logistics; no inappropriate sales pitch. |
| Cold live call booking; repeat booking; reschedule/cancel | Accurate conversion attribution and unchanged booking/Google Calendar/email lifecycle. |
| Backup, old backup import, privacy export, trash/purge, scoped user | New records covered, tenant/team scope preserved, no old emails replayed on restore. |
| Peak reminder cohort | Measured queue delay meets the reminder window without starving existing work. |

Run meaningful unit tests, database integration tests against a disposable Supabase database, and local/staging browser journeys. The current migration CI rebuilds/lints SQL, but that alone does not prove registration, eligibility, concurrency, or repeat-session behavior. Add transactional database assertions for those cases.

For implementation releases, run the established checks: `npm test`, TypeScript, lint, and the Cloudflare production build/dry run, plus the focused database/browser scenarios above. Set `E2E_BASE_URL` explicitly to the local or staging instance: the repository's Playwright default targets production. Direct test email delivery to a controlled recipient.

### Deploy in compatibility order

1. Record baseline behavior and take the existing private CRM backup before migration. Record the current worker version; follow [operations-runbook.md](C:/Users/p-bur/Clientes/Vance/docs/operations-runbook.md:7).
2. Apply additive schema/RPC compatibility updates first. No new live queue items are enabled while old workers lack their template resolver.
3. Deploy code that understands both legacy and live contexts, with live registration/automation disabled. Verify existing CRM, evergreen, booking, and email health.
4. Enable one internal session and controlled recipients. Exercise actual durable registration, questions, cross-device joining, reminder timing, and CRM visibility.
5. Enable live capture and live sends separately for the first real session. Monitor rejected questions, identity gaps, queue lag, failed sends, and unexpected evergreen enrollment.
6. Expand to repeat sessions only after the same-contact/two-session test and first-session reconciliation pass.

**Rollback:** disable live registration/sends and cancel or pause only affected live pending messages. Keep the compatible schema and recorded activity. A worker rollback alone does not undo a migration, and an old email worker can fail on new template keys; pause those messages before reverting a worker. Preserve sent history, do not drop tables, and prefer a forward corrective migration. External messages already sent cannot be undone.

Backups require explicit version compatibility: the current validator expects a fixed table list/version. Introduce an updated backup format that includes live sessions/registrations and accepts old backups through a tested upgrade path. Restoring a pre-live snapshot must have explicit behavior for newer live records and preserve the current rule that restored pending sends are cancelled; verify this in a disposable database.

Recoverable contact trash also needs its own snapshot/restore update. A cascading foreign key alone would delete session registrations when a contact is trashed and fail to restore them on undo. Keep existing anonymous-event retention rules and contact-linked question export/erasure behavior.

## 5. Inputs needed before enabling a real session

These are launch inputs, not blockers for designing the integration:

- Confirmed session dates/timezones, streaming provider, and joining URL. Current event values are placeholders.
- The provider's playback/presence capabilities, which determine whether attendance is measured from playback or in-session page presence.
- Maximum expected registrations, to set and test reminder throughput.
- Final email copy and whether a replay will be produced/published.

A full webinar-platform integration, watch-duration analytics, and a separate Q&A moderation inbox can follow later. The first release should prioritize accurate registration, questions visible on contacts, session-specific follow-up, repeat-session identity, and preservation of existing CRM operations.

## 6. Validation performed for this plan

Read the live-funnel guidelines, frontend instrumentation, registration/booking/tracking APIs, CRM readers and components, email scheduling/routing/delivery, checked-in database migrations, backup/privacy code, and validation/operations configuration.

Executed the existing tests for events, stages, segments, sequence routing, and email scheduling: **5 files, 66 tests passed**. These establish a narrow baseline; they do not verify the proposed live behavior or the deployed database. No production test registrations, questions, bookings, or emails were created.
