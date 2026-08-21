# Vance Dotson Website — Functional Implementation Roadmap

Last updated: 2026-08-21

This document is the working backlog for turning the approved website shell into a production system. Check an item only after its acceptance criteria pass in the Cloudflare deployment.

## Current state

The design and navigation are substantially complete. Supabase now holds contacts, events, notes, tasks, tags, and pipeline state durably. Settings, owners, sequences, booking, and automation still contain demonstration behavior and must be migrated.

The following are demonstrations, not production integrations:

- CRM contacts, events, notes, tasks, settings, owners, tags, pipeline, imports, and exports
- Webinar playback and watch-progress tracking
- Call availability and booking confirmation
- Email delivery, delayed sequences, reminders, and notifications
- Calendar synchronization
- Authentication and authorization

The public site and CRM are currently deployed at `https://vance-dotson.anadias-dev.workers.dev`.

## Client account transfer

- [x] Transfer the production Supabase project to the client-owned Vance Dotson organization.
- [x] Copy the verified production Git history to `vancedotson/BadCredittoCash` without replacing the original Pedro repository remote. Completed 2026-08-21: client `main` matches commit `9785d9f`.
- [ ] Deploy and validate the Worker in the client-owned Cloudflare account.
- [ ] Configure the production domain and remaining client-owned integrations, then complete end-to-end launch validation.

## Non-negotiable implementation order

### 0. Protect private and write-capable surfaces — P0

Status: `[~] In progress — Supabase Auth deployed; CRM pages and APIs protected; initial admin activated`

Problem: `/crm`, its contact detail pages, and all `/api/crm/*` endpoints are publicly accessible. Public lead, booking, and tracking endpoints also have no abuse controls.

Work:

- [x] Require authentication for every `/crm/*` page.
- [x] Require authenticated authorization for every `/api/crm/*` endpoint.
- [x] Define roles: admin, staff, and readonly, enforced in APIs and database policies.
- [x] Ensure exports, imports, bulk deletion, settings changes, and data reset are admin-only.
- [x] Add CSRF/origin protection to authenticated mutations.
- [x] Add request-size limits and rate limits to public POST endpoints.
- [x] Add Turnstile to registration and booking forms.
- [x] Remove or disable the seeded CRM dataset in production. Authenticated CRM requests now hydrate from Supabase, replacing the seed arrays before rendering.
- [x] Add security headers and review cookie/session settings.
- [x] Record security-relevant admin actions in an audit log.

Acceptance criteria:

- An anonymous request cannot read CRM HTML or CRM API data.
- An anonymous or cross-site request cannot mutate, export, import, or reset CRM data.
- Registration and booking still work publicly with abuse protection.
- Production contains no seeded example contacts.

Account decision:

- **Chosen:** Supabase Auth in the same free Supabase project as the CRM database. This avoids Cloudflare Zero Trust onboarding, which requires payment details even on its free plan.

### 1. Durable data layer — P0

Status: `[~] In progress — schema/RLS deployed; contacts, events, notes, tasks, tags, and pipeline changes are durable`

Problem: `src/lib/store.ts` uses `globalThis` and seeded arrays. Data is ephemeral and unsafe in a distributed Worker runtime.

Core schema:

- [x] `contacts`: identity, contact details, source, UTM attribution, owner, stage, lost reason, timestamps.
- [x] `events`: append-only behavioral and system events with JSON properties.
- [x] `notes`: contact notes, author, timestamps.
- [x] `tasks`: status, due time, priority, type, recurrence, owner, completion timestamps.
- [x] `tags` and `contact_tags`.
- [x] `owners` or users/team members.
- [x] `settings`: business profile and CRM preferences.
- [x] `bookings`: selected start/end, timezone, status, provider IDs, intake answers.
- [x] `sequence_enrollments` and `scheduled_messages`.
- [x] `audit_log` for administrative changes.

Data behavior:

- [x] Enforce case-insensitive unique contact email and deterministic upsert behavior.
- [x] Add indexes for email, stage, owner, task due date, event/contact/time, and booking time.
- [x] Use transactions for lead registration, event recording, and automation enrollment. Registration, identity aliasing, event creation, and durable pre-webinar enrollment now commit in one database transaction.
- [~] Implement migrations and a repeatable local/test seed separate from production. Migrations are live; an optional local-only seed remains.
- [~] Replace every in-memory store function without changing callers unnecessarily. Contact CRUD, pipeline moves, ownership, notes, tasks, recurrence creation, tags, and bulk contact mutations now use Supabase; settings, sequences, booking, and automation remain.
- [x] Add backup/export and restore procedures. Full relational JSON backup, validation preview, and atomic restore verified on 2026-08-11.
- [x] Define data retention and deletion behavior. Contact suppression, privacy export, recoverable Trash, permanent deletion, and backup/restore behavior are implemented and verified.

Acceptance criteria:

- Data survives deployments and is consistent across simultaneous Worker instances.
- Duplicate form submissions do not create duplicate contacts or bookings.
- Every CRM screen reads and writes durable data.
- A clean environment can be created entirely from migrations.

Account decision:

- **Chosen:** Supabase Postgres, because the repository already has a Supabase seam and CRM queries will benefit from relational data and constraints.

### 2. Lead registration and attribution — P0

Status: `[~] In progress — durable idempotent registration, attribution, consent, welcome delivery, and abuse protection are live`

- [x] Persist registration reliably and idempotently.
- [x] Normalize and validate email and phone server-side.
- [x] Capture UTM parameters, `gclid`, `fbclid`, referrer, landing page, and first/last touch.
- [x] Store consent text/version, timestamp, IP-derived country where permitted, and marketing consent separately.
- [x] Add Turnstile verification and server-side rate limiting.
- [x] Return useful field errors without exposing internals. Client and server validation now identify and focus the rejected field while unexpected failures remain generic.
- [x] Send the promised training email.
- [x] Alert the CRM owner for high-intent registrations if enabled. The production database trigger, deduplicated CRM-bell notification, contact deep link, and Settings toggle were manually verified on 2026-08-12 with `H Intent` / `p.burmesterm+vancehighintent1@gmail.com` at the 75% watch milestone.
- [x] Add failure monitoring and retry behavior.

Acceptance criteria:

- A valid submission creates or updates one contact, records attribution and consent, starts the correct sequence, and sends one welcome email.
- Retries and double-clicks remain idempotent.
- Spam and malformed requests are rejected.

### 3. Email delivery and automation engine — P0/P1

Status: `[~] In progress — Resend delivery, durable scheduling, verified delivery/engagement webhooks, segment progression, and booking cancellation are live in safe test mode`

Problem: sequence enrollment currently records an `email_queued` event only. Nothing schedules or sends.

- [x] Connect Resend in safe testing mode (all messages redirect to Ana's verified Resend inbox).
- [ ] Verify a sending domain and configure SPF, DKIM, and DMARC.
- [x] Build branded HTML and plain-text templates.
- [x] Render configured watch/call link merge fields.
- [x] Persist sequence enrollment, message schedule, provider message ID, and delivery state.
- [x] Run delayed messages through an atomic Supabase queue and Cloudflare Cron Trigger.
- [x] Evaluate conditions at send time: watched, booked, consent, suppression, and sequence state are enforced; verified provider bounce, complaint, suppression, and unsubscribe events immediately stop incompatible sends.
- [x] Stop pitch/nurture sequences immediately after booking.
- [x] Implement booking confirmation, reminder, reschedule, and cancellation emails.
- [x] Receive and verify provider webhooks for delivered, bounced, complained, opened, and clicked events.
- [x] Implement signed unsubscribe links, durable opt-out state, and immediate cancellation of incompatible queued messages.
- [x] Provide retry/dead-letter handling and an admin view of failures.
- [ ] Obtain final approval for all sequence copy before enabling sends.

Acceptance criteria:

- Each qualifying contact receives the right message once and at the right time.
- Booking or unsubscribe cancels incompatible future messages.
- Delivery state is visible on the contact timeline.
- Bounces and complaints are suppressed automatically.

### 4. Real webinar experience — P1

Status: `[~] In progress â€” Google Calendar availability and two-way booking lifecycle synchronization are live and manually verified`

Problem: the player simulates a 45-second webinar; there is no real recording.

- [ ] Receive and host the approved webinar video.
- [ ] Choose playback provider (Cloudflare Stream recommended if using the existing Cloudflare account).
- [ ] Replace the simulated player with the real player SDK/embed.
- [ ] Persist playback position per contact/device where appropriate.
- [ ] Record reliable 25/50/75/90/completed milestones without duplicates.
- [ ] Reveal the booking CTA at the approved pitch timestamp.
- [ ] Handle autoplay restrictions, mobile playback, captions, transcript, poster, and loading/error states.
- [ ] Add accessible captions and a transcript.
- [ ] Prevent trivial client-side event spoofing from corrupting core reporting.

Acceptance criteria:

- The approved recording plays across current desktop/mobile browsers.
- Watch milestones and CTA timing match actual playback.
- Refreshing resumes appropriately and does not duplicate milestones.

### 5. Real appointment scheduling — P1

Status: `[~] In progress — the versioned first-party event contract and public ingestion validation are implemented`

Problem: slots are generated locally and do not represent actual availability. A submission records a preference, not a calendar event.

- [x] Choose calendar source: Google Calendar.
- [x] Define the initial appointment rules: 30-minute calls, fixed offered hours, no same-day booking, bounded horizon, and explicit timezone storage.
- [x] Query Google Calendar free/busy availability server-side and fail closed when it is unavailable.
- [x] Protect final submission against races with a second live availability check and an atomic active-slot claim; temporary holds are intentionally unnecessary.
- [x] Create the real Google Calendar event with the contact details.
- [x] Store provider event ID and booking status.
- [x] Prevent duplicate CRM bookings transactionally and compensate by removing an orphaned Google event if persistence loses the race.
- [x] Implement authenticated CRM reschedule and cancellation controls synchronized with Google Calendar.
- [x] Reconcile direct Google Calendar moves and deletions through the existing five-minute Cloudflare maintenance cron.
- [x] Show confirmed date, time, timezone, Google Calendar action, and downloadable `.ics` file on the booked page.
- [x] Trigger confirmation, reminder, reschedule, and cancellation sequences.

Acceptance criteria:

- Only genuinely available slots are shown.
- Two users cannot book the same slot.
- A successful booking appears in the connected calendar and CRM.
- Reschedules/cancellations remain synchronized.

Manual verification completed 2026-08-10: an existing Google event disabled the overlapping public slot; a fresh booking created a Google event and confirmation email; rescheduling moved the event and sent an update; cancellation removed the event, sent an email, and released the slot again. A second fresh booking displayed its exact date/time/timezone on the success page, and both Google Calendar and `.ics` actions worked.

External-change reconciliation verified 2026-08-10: moving the event directly in Google Calendar updated the CRM and queued a reschedule email; deleting it directly cancelled the CRM booking and sent the cancellation email. The reconciler runs in bounded batches and isolates calendar failures from the email queue.

### 6. CRM production hardening — P1

Status: `[~] In progress — existing contact, pipeline, note, tag, and task controls now persist to Supabase; hardening remains`

Existing UI flows to preserve and connect:

- Contacts: create, edit, filter, sort, paginate, tag, assign, import, export, bulk actions, delete.
- Pipeline: drag stages, lost reasons, ownership, stage aging, conversion metrics.
- Tasks/calendar: create, edit, complete, recur, reschedule, filter, and associate with contacts.
- Contact detail: timeline, notes, tasks, sequence state, engagement snapshot.
- Settings: owners, tags, profile, preferences, backups.

Connected in the current slice:

- [x] Create, edit, assign, stage, tag, and delete contacts.
- [x] Pipeline drag/stage changes and lost-reason persistence.
- [x] Add contact notes.
- [x] Create, edit, complete, delete, and spawn the next recurring task.
- [x] Existing bulk stage, owner, tag, task, and delete actions write to Supabase.

Missing production behavior:

- [x] Database-backed pagination/filtering rather than loading and filtering arrays. Supabase paging, totals, and filters verified on 2026-08-11.
- [x] Optimistic concurrency and conflict handling for simultaneous contact edits. Verified with two stale browser tabs on 2026-08-11.
- [x] Confirmation and recovery path for destructive actions. Contact trash and full relationship restore verified on 2026-08-11.
- [x] Import preview, column mapping, validation report, deduplication, and limits. Verified with malformed/duplicate rows and a full CRM export round trip on 2026-08-11.
- [x] Proper restore flow for exported backups. Versioned snapshot restore verified end to end on 2026-08-11; restored pending messages are cancelled for safety.
- [x] Audit history for stage, owner, tag, settings, task, import/export, and deletion changes. Admin-visible before/after history verified on 2026-08-11.
- [x] Recurring-task scheduler rather than UI-only recurrence metadata. Atomic completion and exactly-one next occurrence verified on 2026-08-11.
- [x] Real notifications for overdue tasks, new bookings, and cooling leads. All three alert types verified on 2026-08-11.
- [x] Notification read/dismiss state. Read and dismiss persistence verified on 2026-08-11.
- [x] Search that scales beyond the in-memory dataset. Indexed database name/email search verified on 2026-08-11.
- [x] Privacy controls: complete single-contact export, durable suppression/unsuppression, and admin-only permanent deletion of the contact and related CRM records. Verified in production on 2026-08-11.
- [x] Clear empty, loading, failure, and retry states throughout. CRM routes and mutation-heavy contacts, tasks, pipeline, calendar, backup, and privacy workflows have resilient recovery states.

Acceptance criteria:

- All existing CRM controls persist correctly across devices and deployments.
- Destructive and bulk actions are permissioned, confirmed, logged, and recoverable where practical.
- Large contact sets remain usable.

### 7. Analytics and funnel reporting — P1

Status: `[~] In progress — the versioned first-party event contract and public ingestion validation are implemented`

- [x] Define canonical event names, versions, required fields, and identity rules. Version 1 uses the central event vocabulary, requires a client event ID and anonymous visitor ID, validates known watch milestones, and normalizes known email identities. The registration-to-50%-watch journey was manually verified in production on 2026-08-13 with `A Analytics` / `p.burmesterm+vanceanalytics1@gmail.com`.
- [x] Issue an anonymous visitor/session ID before email is known, then alias it after registration. Manually verified in production on 2026-08-13 with `Visitor Alias` / `p.burmesterm+vancealias1@gmail.com`: a confirmation-page event recorded before registration was attached to the contact afterward.
- [x] Deduplicate events with client-generated event IDs.
- [x] Capture page views, CTA clicks, registration, quiz, webinar milestones, booking start, booking success, and errors. Public page views were manually verified in production on 2026-08-13 with `Page View` / `p.burmesterm+vancepageview1@gmail.com`; privacy-safe error capture and anonymous-to-contact attachment were verified with `Error Track` / `p.burmesterm+vanceerror1@gmail.com`.
- [x] Validate allowed event names and property sizes server-side.
- [x] Add bot/internal-traffic filtering and retention rules. Obvious crawler user-agents are ignored server-side. Internal filtering was manually verified in production on 2026-08-13 with `Internal Test` / `p.burmesterm+vanceinternal1@gmail.com`: `?internal=1` suppressed optional analytics while registration and required system events still worked. `?internal=0` re-enables tracking. The maintenance cron removes only unclaimed anonymous events older than 90 days in bounded batches; contact/email-linked CRM history and audit records are preserved.
- [ ] Connect approved ad/analytics destinations: GA4, Meta Pixel/CAPI, Google Ads, etc.
- [ ] Implement consent-aware loading where required.
- [ ] Reconcile server-side conversions with provider IDs.
- [x] Make CRM funnel metrics query durable events rather than seeded state. The Overview funnel now uses a protected database aggregate with deduplicated identities and owner filtering instead of counting an in-memory event array.

Acceptance criteria:

- One test journey can be traced from landing session through registration, watch milestones, and booking.
- Counts are deduplicated and attribution fields are available in CRM/reporting.

### 8. Notifications and operational automation — P2

Status: `[ ] Not started`

- [x] Durable new-lead and new-booking bell alerts. Database triggers create deduplicated alerts for every CRM user when future contacts or bookings are inserted; existing contacts are not backfilled, avoiding a noisy rollout.
- [x] Daily overdue-task digest. The existing maintenance cron atomically claims one Lisbon-calendar-day digest, sends a bounded list of current overdue open tasks through the configured Resend test inbox, and uses a provider idempotency key to prevent duplicate delivery across Worker instances.
- [x] Cooling-lead/no-follow-up alerts based on actual rules. Durable, deduplicated notifications are derived from contact activity, watch/intent progression, booking state, quiet-time thresholds, and open-task state; the existing five-minute maintenance job refreshes and resolves them.
- [x] Failed email and failed booking alerts. Permanent email failures and privacy-safe booking errors now create deduplicated, durable CRM bell alerts with contact links when an identity is available. Notification refresh runs in the existing five-minute maintenance cron instead of blocking every CRM page load.
- [x] Scheduled cleanup/reconciliation jobs. One authenticated Cloudflare Cron Trigger runs every five minutes and isolates email queue processing, Google Calendar reconciliation, notification syncing, and bounded 90-day anonymous analytics cleanup with `Promise.allSettled`.
- [x] Worker logs, error tracking, uptime checks, and alerting. Cloudflare Worker observability captures structured application and cron errors. A privacy-safe `/api/health` route checks the Worker-to-database path, while a free GitHub Actions monitor checks it externally every 15 minutes with retries and alerts repository maintainers when the workflow fails.
- [x] Authenticated, read-only system health page for database, email configuration, durable email queue counts, and a live Google Calendar dependency check. The checks run only when opened, use no paid monitoring service, fail independently, and expose no credentials.
- [x] Document rollback, backup, restore, and incident procedures. The operational runbook covers pre-deployment backups, Worker version rollback, transactional CRM restore, forward-only migration recovery, incident triage, verification, and safe incident records.

### 9. Content, compliance, and launch assets — P0 before client launch

Status: `[ ] Blocked on business/client inputs`

The repository itself flags these as unresolved:

- [ ] Confirm attorney/advocate status and permitted claims.
- [ ] Reconcile guarantee language and complete CROA/legal review.
- [ ] Confirm pricing and advance-fee compliance.
- [ ] Replace placeholder phone, email, address, photos, testimonials, recordings, and result captions.
- [ ] Verify licensing/bonding statements.
- [ ] Create real Privacy Policy, Terms, contact details, unsubscribe, and data-request paths.
- [ ] Obtain testimonial/media releases and define retention for sensitive consumer data.
- [ ] Complete Meta restricted-financial-services review for ads and tracking.
- [ ] Configure the production domain, redirects, canonical URL, social metadata, and email domain.

Acceptance criteria:

- Every factual claim, contact detail, policy link, testimonial, and asset is approved and real.
- The site has a documented legal/compliance sign-off before paid traffic.

### 10. Quality and release process — continuous

Status: `[ ] Not started`

- [x] Unit tests for validation, segmentation, stage derivation, scheduling, and sequence conditions. Vitest coverage added on 2026-08-13 for segmentation, automatic stages, public-event allowlisting, task fields, booking slots, email timing, and segment-to-sequence routing.
- [x] Integration tests for database repositories and provider webhooks. Resend webhook request verification/filtering/database handoff and CRM backup repository export/error/validation coverage added on 2026-08-13.
- [x] End-to-end tests for registration, webinar, booking, and authenticated CRM workflows. Playwright live smoke coverage added on 2026-08-13 for homepage/registration, confirmation/training/player, booking-wizard interaction, and anonymous CRM access control; real registration, booking, and signed-in CRM workflows were also manually verified end to end.
- [ ] Accessibility audit and keyboard/screen-reader testing. Automated WCAG A/AA homepage scan added on 2026-08-13; keyboard and screen-reader checks remain.
- [ ] Responsive/browser testing.
- [ ] Performance/Core Web Vitals budget.
- [x] Dependency and secret scanning. Production and development dependency audits were reduced to zero known vulnerabilities on 2026-08-14. A pinned GitHub Actions workflow audits the locked dependency tree and scans full Git history for secrets on pull requests, `master`, weekly, and on demand; local generated and machine-specific paths are ignored.
- [ ] Staging and production environments with separate data and provider credentials.
- [x] Preview/dry-run deployment checks in CI. A pinned GitHub Actions workflow installs the locked dependency tree, runs unit/integration tests, TypeScript, lint, and an OpenNext Cloudflare build followed by `wrangler deploy --dry-run` on pull requests, `master`, and on demand. It never deploys or reads production secrets.
- [x] Database migration checks and rollback procedure. A pinned GitHub Actions workflow rebuilds a disposable local Postgres database from every migration in order and fails on SQL function errors; it never connects to production. Forward-only recovery and Worker/database rollback boundaries are documented in the operations runbook.

## Proposed delivery milestones

### Milestone A — Safe foundation

Items 0 and 1. Private CRM, protected APIs, durable schema, no seed data in production.

### Milestone B — Real lead capture

Items 2 and the transactional portion of 3. Real registrations, attribution, consent, welcome email, monitoring.

### Milestone C — Real conversion funnel

Items 4 and 5. Real webinar and real calendar booking with confirmations/reminders.

### Milestone D — Automated CRM

Remaining items in 3, 6, 7, and 8. Sequences, reporting, notifications, operational reliability.

### Milestone E — Client launch

Items 9 and 10. Client-owned accounts and domains, content/legal approval, full verification, production handoff.

## Account and credential handoff strategy

During development, integrations may use the developer's accounts, but no account-specific identifier or secret should be committed to Git.

- Keep account/resource identifiers in environment-specific Cloudflare configuration where appropriate.
- Store secrets with Wrangler/Cloudflare secret management, never in source or `.env` committed files.
- Create provider adapters so changing from developer resources to client resources is configuration, not a rewrite.
- Maintain a handoff checklist listing each resource, owner, domain/DNS change, webhook URL, secret, and verification step.
- Use separate development/staging and client-production data; do not copy real consumer data into development.

## Immediate next decision

The chosen foundation is Supabase Auth plus Supabase Postgres on the free plan. The first implementation slice is: protect `/crm` and `/api/crm/*`, create the database migrations, replace lead/event persistence, remove production seed data, and verify registration-to-CRM persistence on Cloudflare.
