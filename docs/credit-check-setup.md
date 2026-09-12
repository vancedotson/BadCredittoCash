# Credit-check lead magnet

Repository: `vancedotson/BadCredittoCash`, branch `main`. Follow `AGENTS.md` for
workspace-scoped GitHub authentication; no global account switch is needed.

The funnel starts at `/credit-check`, posts the selected credit-report companies and contact details to
`/api/credit-check`, then continues to `/credit-check/thank-you` after a confirmed save.
The thank-you page shows one step at a time: use a computer, get three credit-report
PDFs, and send them to Vance. The three-step row is a progress display, not navigation.

## CRM workspace

**Lead magnet** in the CRM navigation opens `/crm/lead-magnet`. It shows total
unique signups, first-time signups over the last 30 days, people waiting for PDFs,
and people with all three bureaus received. Search and report-status filters help
Vance find people who have sent none, some, or all three reports. Totals remain
global while the list is filtered and paginated.

Each row includes the latest submitted companies and signup date, links to the
existing contact, and direct authenticated downloads for the newest retained PDF
from each bureau. **View reports** opens the existing private report panel with
all retained uploads and their filenames/dates. Closing it refreshes the list;
**Refresh** checks for new signups and uploads without changing filters.

People are identified through `credit_check_submitted` events, including existing
CRM contacts whose original source is a webinar or another channel. Repeated
submissions count as one person, with their submission count shown separately.
Report status counts distinct bureaus across that person's retained uploads, not
only the latest submission. Receiving a PDF does not mean its content was reviewed.
Trashed contacts and contacts undergoing permanent deletion are excluded.

This view adds the read-only migration
`supabase/migrations/20260912230000_lead_magnet_workspace.sql`. Its database function
requires an authenticated CRM member, paginates in the database, and returns only
contact and receipt metadata. PDF downloads keep the existing contact-level
authorization, private Storage, and no-store responses. No contact stage, owner,
email enrollment, upload protocol, or public storage access is changed.

Local CRM demo mode shows explicitly labeled fictional signups and receipt
metadata. It never reads local intake files or serves real PDFs; demo download
links are omitted. The local preview is `http://127.0.0.1:3101/crm/lead-magnet`.

## Local preview

Run `npm run dev`. With no server-side Supabase credentials, development submissions
are written to `.local/credit-check/<submission-id>.json`. This folder is ignored by
Git and is outside `public`; no HTTP download endpoint exposes its contents.
Each file includes name, normalized email and phone, all answers, attribution, and
submission time. Security tokens are never saved. The API explicitly returns
`{ ok: true, mode: "local", id }` only after the file has been written and synced.
These records stay on this machine and are not sent to the CRM or by email.
After a new quiz submission, each report slot can accept and send a PDF. Files and
receipts are durably saved outside `public`, under `.local/credit-check-reports/`.
Green checks in local mode explicitly mean saved on this computer. Existing quiz
submissions from before uploads were added need a fresh submission to get a session.
Use fictional contact details for local testing; local files use the operating
system's account permissions and are not encrypted. Remove individual test records
when they are no longer needed.

Local mode only exists when `NODE_ENV` is `development` and database credentials are
absent. It cannot silently replace a failed database save, and is disabled in a
production build. Its development rate limiter permits 10 attempts per 10 minutes
per local client identity and resets when the process restarts.

## Before going live

1. Apply the repository migrations, including these in order:
   `supabase/migrations/20260909120000_credit_check_lead_capture.sql`,
   `supabase/migrations/20260909150000_credit_report_uploads.sql`, and
   `supabase/migrations/20260909160000_credit_report_lifecycle.sql`, followed by
   `supabase/migrations/20260911120000_simplify_credit_check_companies.sql` and
   `supabase/migrations/20260912230000_lead_magnet_workspace.sql`, to the intended
   Supabase project through the normal deployment process. This task does not apply
   that migration or write to a remote database.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and server-only `SUPABASE_SECRET_KEY`.
3. Configure `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and server-only `TURNSTILE_SECRET`
   for the published hostname. Database mode, including development connected to
   a database, returns an unavailable response if either security setting is
   missing. Production also refuses to accept submissions without a database.
   Database mode uses the existing database
   rate limiter (registration bucket, 10 attempts / 10 minutes).
4. The supplied 42-page PDF is served unchanged at
   `/guides/annual-credit-report-guide-vance-dotson.pdf`, configured in
   `src/config/credit-check.ts`. The thank-you page highlights computer use,
   all three bureaus, and saving each full PDF before moving on. Optional help
   includes address history and page links using the PDF's physical page numbers
   (9, 11, 18, 33, 41). Recheck those links when replacing the PDF. Step navigation
   is local to the page visit and does not verify files or transmit information.
   The page does not claim an email was sent.
5. Verify a test submission against the intended database before publishing.
6. Test PDF upload and authenticated download against the intended database before
   publishing. The report migrations create a private `credit-reports` bucket,
   receipt/session tables, and coordinated deletion functions. No public Storage
   policies or public file URLs are used. Vance accesses uploaded files in the
   contact's **Credit reports** section of the authenticated CRM. Demo CRM access
   is explicitly denied. Production migrations and live Storage integration have
   not been executed or verified in this local task. Disposable SQL tests verify
   the workspace read model and permissions without accessing customer data.

## Upload behavior

Each bureau has a Choose PDF control and its own Send PDF button. Merely choosing
a file does not create a receipt. Successful saves return a timestamped receipt;
the page restores those receipts after reload and allows replacement. Failed
replacements preserve the prior file. Files selected but not sent remain only in
the browser and are cleared on a full page reload.

The server enforces the three bureau identifiers, PDF filenames and basic PDF
header/end-marker checks, a 15 MiB stream limit, same-origin requests, and rate
limits. These checks do not establish that a PDF is the correct bureau report,
contains every page, is malware-free, or belongs to the submitter. The check mark
confirms receipt, not a content review.

A successful quiz issues a random, seven-day upload capability. Only its hash is
stored server-side. The browser receives it in an HttpOnly, SameSite=Strict cookie
(Secure in production). The personal desktop link carries the capability in the
URL fragment; the page exchanges it for a cookie and removes the fragment.
The capability permits upload and receipt metadata only, never PDF download.
Each request also includes the displayed session ID; a changed browser session
blocks sending until the page is restarted, protecting against cross-tab mixups.
Keep personal links private. Expired sessions require a new quick check.

## Report lifecycle and operations

Recoverable CRM Trash retains private report files and metadata. Access requires
an active contact, and restoring the same contact reconnects its reports. Permanent
deletion first revokes upload sessions and prevents new uploads, then removes
every private object under the exact contact prefix, then deletes the report and
CRM records. Storage or database errors stop final deletion and allow a retry.

An interrupted or ambiguous Storage request deliberately leaves an unfinished
`credit_report_upload_attempts` row. This blocks permanent deletion until an
operator verifies that the remote write has finished, reconciles any private
object, and marks the attempt complete. Do not expire or clear pending attempts
on a timer: doing so could permit a late write after a purported deletion.

CRM JSON backups and privacy JSON exports do not contain PDF bytes. Back up private
Storage separately with its receipt metadata when designing the live backup plan.

The dedicated `submit_credit_check_v1` RPC atomically adds a new contact when needed,
an event containing the submitted contact details and selected companies, and a
readable CRM note. Existing contact fields, owner, stage, suppression, and marketing
consent are preserved. New contacts use source `credit-check` and the database's
default false marketing consent. Existing CRM new-contact notifications may appear.
This flow does not register anyone for the webinar, enroll email sequences, send
email/SMS, or grant marketing consent.

The public API accepts only the documented fields and company options, requires at
least one selection plus name, email, and phone, limits JSON to 16 KiB, rejects cross-origin browser submissions,
and returns no contact details in its response. The signup transaction and CRM
workspace are exercised in disposable SQL regression tests. Hosted Supabase and
actual private Storage integration remain deployment verification steps.

## Workspace verification

For this implementation, 465 unit/API tests and 15 focused browser checks pass,
including existing report storage, authenticated downloads, mobile CRM navigation,
and pipeline regressions. The new page and report dialog pass automated accessibility
checks in light and dark themes at desktop and mobile sizes.

All 61 repository migrations and four transactional SQL suites pass in disposable
PostgreSQL through PGlite with Supabase auth/storage stubs. The lead magnet suite
checks repeat signups with an existing source, latest retained bureau receipts
across sessions, older backup/event retention, expired upload capabilities,
legacy stage values, global counts under filters, pagination beyond 1,000 people,
Trash/restore, purge exclusion, and anonymous/nonmember/member permissions.
GitHub's database workflow also runs these suites against disposable Supabase.

TypeScript, lint (apart from two existing generated-worker warnings), the production
Next build, OpenNext bundling, and the Cloudflare deployment dry-run pass. Local
screenshots and build logs stay in ignored `.local/`. No production database
migration, customer upload, email send, or site deployment is performed by these
checks.
