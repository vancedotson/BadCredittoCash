# Live webinar CRM extension

Implemented September 12, 2026. The original review is in [crm-integration-plan.md](./crm-integration-plan.md). This document describes the resulting behavior and activation sequence.

## Using the CRM

- **Live webinars** at `/crm/webinars` creates and edits sessions, including title, date/time, timezone, player, cancellation, replay, and email controls. Create a separate session for each new webinar; edit dates to postpone the same webinar. URL names stay fixed to preserve existing links.
- Contacts and Activity have independent **Funnel** and **Session** filters. Existing Source and UTM attribution remain available. A contact can belong to both funnels and any number of sessions.
- Contact history shows each registration, room entry, in-session presence, replay opening, call-booking progress, and its queued/sent/failed messages. Questions appear in full in Timeline and Activity, grouped by session. CSV exports neutralize spreadsheet formulas in participant text.
- Session reports count registrations, presence, finalized lack of attendance, replay opens, and attributed bookings. Booking counts include direct visitors who did not register and therefore need not match the registration denominator.
- A booking attempt becomes **Booking incomplete (30m+)** only after 30 minutes without a completed, uncancelled booking associated with that registration. This is an observation when the report is loaded; it does not emit a tab-close event or start an abandonment email sequence.

## Capture and identity

`live_webinar_sessions` stores the schedule; `live_webinar_registrations` has one row per contact/session. Repeating a registration does not create another contact or joining-email intent. Registering for a different session creates independent participation and messages.

New contacts use source `vance-live-webinar`. Existing contacts keep their source, ownership, consent/suppression, and saved sales stage. New live contacts can advance automatically from new to engaged; a staff stage edit switches that contact to manual control. Won/lost decisions stay protected. Existing `call_booked` stage values display as Booked.

Joining links carry a signed, expiring registration token without raw email. `/api/live/join` verifies it, exchanges it for an HttpOnly session cookie, and redirects to a clean URL before page tracking. Access versions allow revocation and invalidate links when a trashed contact is restored. These links grant participation only, never CRM access.

Question submissions receive success only after the database saves them. Retries reuse a submission ID; different questions remain separate. Question text bypasses the general analytics dataLayer. A shared browser's participant cookie is attached to a booking only if its contact email matches the booking email.

Presence means a visible room page with a configured player during the scheduled session. It does **not** prove playback or time watched. Heartbeats update the registration's last presence time while retaining one evidence event. Early room entry and opening a replay do not fabricate attendance or watch percentages. YouTube and Vimeo embed origins are supported; provider-specific playback analytics are a separate future integration.

## Email behavior

Live enrollment and delivery identities include the registration/session context. Existing evergreen and appointment templates keep their keys and legacy context. Live activity is excluded from evergreen watch-depth automation and funnel metrics; a confirmed call still counts as a contact conversion.

| Message | Timing and restrictions |
| --- | --- |
| Joining confirmation | Durable intent created with registration; immediate delivery attempted when enabled. |
| Day-before reminder | Start minus 24 hours; late registrations skip it. |
| Starting-soon reminder | Start minus 15 minutes; expired reminders are not sent after the start. |
| Attended / no attendance | One post-session branch after the default 15-minute grace period; requires promotional eligibility. |
| Replay | Published, available recording after the session; requires promotional eligibility and respects expiry. Late publication without an expiry receives a seven-day notification deadline. |
| Rescheduled / cancelled | Versioned updates invalidate stale pending reminders; sent history remains intact. |

Requested logistics do not require marketing opt-in. Promotions require the existing consent policy. Universal suppression, bounce/complaint, contact trash, sequence pause, and session email controls apply. Eligibility is checked while claiming and immediately before provider dispatch. A message already accepted by the provider cannot be retracted.

The worker runs maintenance every minute. Email delivery drains atomic batches of ten, with 550 ms spacing within batches and a 45-second drain budget. The next batch is started only if its measured duration is expected to fit; a slow in-flight provider request can exceed that estimate. Individual malformed messages and live-scheduler errors do not block unrelated mail. Retry bodies and provider idempotency keys are stable. Throughput depends on provider/network latency: validate queue delay with the expected audience before a large launch. Local fake-provider tests establish bounded draining, not a production capacity guarantee.

## Database and activation

Five additive migrations follow the existing migration history:

1. `20260912100000_live_webinar_foundation.sql` — tables, identities, provenance, permissions.
2. `20260912101000_live_webinar_delivery.sql` — eligibility, scheduling, atomic claims, legacy compatibility.
3. `20260912102000_live_webinar_registration_activity.sql` — registration, activity, and booking transactions.
4. `20260912103000_live_webinar_crm.sql` — contact filters, metrics, alerts, evergreen separation.
5. `20260912104000_live_webinar_privacy_backup.sql` — backup v2, v1 import, contact export, trash/restore, purge.

They do not create real sessions, backfill customer participation, or send messages. Backup exports include both new tables; old backups retain their v1 upgrade path. Restored pending mail stays cancelled, restored sessions have automation disabled, and restored registrations invalidate old joining links.

Apply changes in this order:

1. Follow [the operations runbook](../operations-runbook.md): privately back up the current CRM and record the deployed worker version and database migration history. Compare that history with the repository. Review any existing live-tagged evergreen enrollments separately; this implementation does not guess which historical messages to cancel.
2. Apply the five reviewed migrations before deploying this code. Validate functions and permissions on staging, then deploy with `LIVE_WEBINAR_ENABLED=false`, as checked into `wrangler.jsonc`.
3. Verify existing Contacts, Pipeline, Activity, evergreen registration, booking/calendar, email health, and backup export.
4. In staging, configure a real session, supported embed URL, timezone, and approved email copy. Set `LIVE_WEBINAR_ENABLED=true`. Enable that session's **Enable session emails** control only for the delivery exercise. Use `EMAIL_MODE=test` and `EMAIL_TEST_RECIPIENT` in staging, never by changing the production email mode for unrelated customers.
5. Exercise the same email across two sessions, duplicate registration, joining in another browser, two questions and retry, reminder timing, reschedule/cancel, replay, and booking. Confirm CRM records and intended emails. Check reminder queue lag with the expected cohort.
6. Enable the production global flag and the intended session only after those checks. A scheduled session with session emails off captures participation while holding live delivery. A draft session is not public. Preview URLs never submit registrations, questions, or bookings.

Required launch configuration: real session dates/timezone, player URL, replay decision, reviewed email copy, expected audience, and existing `EMAIL_SIGNING_SECRET` of at least 24 characters. The public pages read the database session; `src/config/live-webinar.ts` supplies copy and preview placeholders, not a second production schedule.

For rollback, turn off the global flag or the affected session's emails and preserve the compatible schema and history. Keep live messages paused before rolling back to a worker that predates these templates. Do not drop tables or restore a whole customer database as a routine rollback.

## Verification

For implementation commit `e6bc4f9`, **379 unit/API tests and 20 local browser tests passed**. GitHub [application validation](https://github.com/vancedotson/BadCredittoCash/actions/runs/34704243359) and [real Supabase migration/function/regression validation](https://github.com/vancedotson/BadCredittoCash/actions/runs/34704243333) passed, as did the secret scan.

**Separate production prerequisite:** the [dependency audit](https://github.com/vancedotson/BadCredittoCash/actions/runs/34704243358) reported 10 vulnerabilities in the existing locked dependencies (4 moderate, 5 high, 1 critical), including Next.js. This extension does not change `package.json` or `package-lock.json`. Review and validate the relevant dependency patches before production activation; do not treat the application/database test results as a passing security audit.

The implementation has unit/API tests, public and CRM Playwright journeys, and three transactional SQL suites under `supabase/tests/`. They cover repeat registrations, retry identities, attendance boundaries, consent/suppression, schedule changes, replay expiry/late publication, booking attribution, backup compatibility, restore/purge, and staff/read-only/nonmember/anonymous permissions.

Local SQL verification applies all 60 migrations to disposable PostgreSQL through PGlite with Supabase auth/storage stubs. GitHub's database validation workflow also rebuilds a real disposable Supabase database, lints functions, and runs all three suites with `psql`. PGlite alone does not prove independent-connection concurrency or production Supabase configuration.

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run cf:dry-run`. Generate worker declarations with `npm run cf-typegen` before `npm run cf-typecheck`. For browser tests set `E2E_BASE_URL` explicitly to localhost/staging: the repository's default browser target is production. Test data and disposable local tooling stay under ignored `.local/`.

No production database migration, customer enrollment, email send, or worker deployment was performed as part of local implementation validation.
