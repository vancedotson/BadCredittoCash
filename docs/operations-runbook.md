# Vance Dotson operations runbook

Use this guide when deploying, backing up, restoring, or responding to a production problem.

Production application: `https://vance-dotson.vancedotson.workers.dev`

Public health check: `https://vance-dotson.vancedotson.workers.dev/api/health`

Public site domain (canonical apex, `APP_BASE_URL`): `https://creditrepairparty.com`. Requests to `www.creditrepairparty.com` receive a 308 redirect to the apex with path and query preserved.

## Live webinar activation (future operator checklist; not an activation instruction)

Live webinars are independent of the evergreen training funnel. The application is deliberately fail-closed: the checked-in `LIVE_WEBINAR_ENABLED` and `CLOUDFLARE_STREAM_ENABLED` values remain `false`, and live registration also requires `LIVE_WEBINAR_EMAILS_APPROVED=true`. Missing email approval is treated as false. Marketing follow-up has its own separate gate. Do not change these settings as part of routine deployment or troubleshooting.

Before a separately approved activation:

1. Confirm the target Worker version and environment, and verify the existing `supabase/migrations/20260916140000_cloudflare_stream_live.sql` migration has been reviewed and applied there. Do not infer migration status from source control.
2. Confirm the client-owned Cloudflare account is eligible for Stream Live and that the owner has approved anticipated provider usage. Preparing inputs or rehearsals can consume paid service resources; do not create one without that approval.
3. Have an authorized operator configure the Stream API token, signing-key ID, and private RSA JWK as Worker secrets. Never place secret values in Wrangler variables, source control, shell transcripts, logs, tickets, or this runbook.
4. Configure the non-secret Worker variable `CLOUDFLARE_STREAM_CUSTOMER_ORIGIN` to the exact `https://customer-<account-code>.cloudflarestream.com` origin provisioned by Stream. This is the Cloudflare Stream API/WHEP endpoint and CSP `connect-src` origin, not an attendee site origin. Do not include a path, wildcard, credentials, or trailing slash. Without a valid value, the browser CSP omits Stream from `connect-src` and Stream preparation fails closed. WHEP SDP/session requests use this origin; WebRTC media itself does not require a broad `media-src` allowlist.
5. Configure the separate non-secret `CLOUDFLARE_STREAM_ALLOWED_ORIGINS` Worker variable with comma-separated exact HTTPS attendee origins. For a separately approved rehearsal during the domain transition, the intended value is `https://vance-dotson.vancedotson.workers.dev,https://creditrepairparty.com`; this code change does not configure production. The parser trims whitespace, ignores empty comma segments, normalizes root slashes/host casing, deduplicates, and rejects the entire value if any entry is malformed or if more than two unique hostnames are supplied. Use DNS hostnames only: no wildcard, IP address, non-root path, query, fragment, credentials, or non-default port. The Worker converts the validated origins to exact hostnames for Stream's `recording.allowedOrigins`. After custom-domain cutover, remove the workers.dev origin if it is no longer needed. Missing/invalid configuration disables Stream preparation; never use an empty Stream allowed-origin list because it allows playback from any origin.
6. Keep `APP_BASE_URL` as the canonical application/email base URL. It does not configure Stream attendee `allowedOrigins`; validate any canonical-base change separately for its own application/email behavior.
7. Approve live confirmation/reminder copy and legal/content claims. Only then may an authorized operator set the live email approval gate. Marketing follow-up remains separately gated.
8. Keep `LIVE_WEBINAR_ENABLED`, `CLOUDFLARE_STREAM_ENABLED`, and `LIVE_WEBINAR_EMAILS_APPROVED` off until separately authorized. When a rehearsal is authorized, an admin prepares an input through CRM Broadcast Studio; independently verify recording mode is off and that participants request playback with their personal registration link. The middleware `Permissions-Policy` allows same-origin camera and microphone (`camera=(self), microphone=(self)`) only on `/crm` and `/api/crm` responses so Broadcast Studio can capture; public pages keep `camera=()` and `microphone=()`.
9. Conduct any host broadcast/rehearsal only under separate explicit authorization. Verify attendee playback, mobile/browser behavior, connection/offline states, and that no replay or recording is created. Do not send test emails to real recipients.

Playback-token security model: the app validates an active participant and session on each issuance, returns a two-minute Cloudflare-signed URL with a 10-second not-before clock-skew allowance, marks the response `private, no-store`/`no-referrer`, and does not store or log the URL. A random JWT ID distinguishes issuances but is not a one-time-use/replay defense. Cloudflare's token authorizes the live input, not a specific registrant: anyone who obtains the URL may use it during its validity, and the app cannot revoke an already-established WHEP connection. This is an explicit residual bearer-token risk, not attendee-bound playback. Do not promise strict per-attendee media enforcement without a separately designed proxy/authorization architecture.

The focused browser suite uses synthetic API and WHEP mocks only. CRM UI/admin checks use static component tests and mocked API role tests, so no Supabase account is needed. In PowerShell, start the local app in one terminal:

```powershell
$env:CLOUDFLARE_STREAM_CUSTOMER_ORIGIN = "https://customer-ab12.cloudflarestream.com"
npm.cmd run dev -- --hostname 127.0.0.1 --port 3006
```

Then run the focused, local-only Chromium suite and CRM/API boundary tests in another terminal:

```powershell
$env:E2E_BASE_URL = "http://127.0.0.1:3006"
npm.cmd run test:e2e -- e2e/live-webinar.spec.ts --project=chromium
npm.cmd test -- middleware.test.ts src/lib/cloudflare-stream-origin.test.ts src/lib/cloudflare-stream-token.test.ts src/lib/cloudflare-stream.test.ts src/app/api/live/session/route.test.ts "src/app/api/crm/live-webinars/[id]/stream/route.test.ts" src/components/crm/LiveWebinarManager.test.tsx
```

Expected checks include public versus participant playback, different-session and unauthenticated issuance denial, expired/tampered short-lived bearer-token claims, CSP allow/deny policy, unsupported WebRTC constructors, admin-only Stream controls, and no evergreen form/replay. The live registration test stubs external APIs and succeeds without requiring Google Calendar; CRM admin/staff/readonly/anonymous decisions are tested with mocked roles because no local auth fixture is configured. The suite refuses non-local browser origins; never point these tests at production or real Stream. Provider rehearsal is still a separate, explicitly authorized launch gate.

If the feature is paused after activation, an authorized operator should first close registration/email gates and follow the approved Cloudflare resource-retention decision. Do not delete inputs, recordings, or related database rows as an improvised rollback. Worker rollback does not reverse database changes. This repository task does not enable flags, create a Stream input, change secrets, run a rehearsal, or send email.

## Authorize.net payments (pay links and manual card charges)

The CRM can email an Accept Hosted pay link and can charge a card manually (**Charge card** in a contact's Payments panel, using the Authorize.net AcceptUI hosted lightbox). Card data is entered only in Authorize.net's form; this app, its database and its logs only ever see a one-time payment token, the processor transaction id, card brand and last four digits. The feature is inert unless `PAYMENTS_ENABLED` is exactly `true` and every setting below is present and valid.

Settings (names are exact):

| Name | Kind | Value |
| --- | --- | --- |
| `PAYMENTS_ENABLED` | Wrangler var | `"true"` to enable, anything else keeps payments off |
| `AUTHNET_ENV` | Wrangler var | exactly `sandbox` or `production`; any other value disables payments and adds no CSP origins |
| `AUTHNET_API_LOGIN_ID` | Worker secret | API Login ID |
| `AUTHNET_TRANSACTION_KEY` | Worker secret | Transaction Key |
| `AUTHNET_SIGNATURE_KEY` | Worker secret | Signature Key (verifies webhooks) |
| `AUTHNET_PUBLIC_CLIENT_KEY` | Worker secret | Public Client Key (AcceptUI). Read server-side only and given just to signed-in CRM users who can write; never a `NEXT_PUBLIC_` variable |

The four `AUTHNET_*` secrets are listed in `secrets.required` in `wrangler.jsonc`, so set them before the first deploy that contains this change (sandbox values are fine).

Sandbox setup:

1. Create or open the Authorize.net **sandbox** account. In the sandbox Merchant Interface open **Account > Settings > Security Settings > General Security Settings > API Credentials & Keys**, and note the API Login ID, create a Transaction Key, a Signature Key and a Public Client Key. Never paste them into chat, tickets, source control or shell history on a shared machine.
2. Store each secret with `npx wrangler secret put AUTHNET_API_LOGIN_ID` (repeat for `AUTHNET_TRANSACTION_KEY`, `AUTHNET_SIGNATURE_KEY`, `AUTHNET_PUBLIC_CLIENT_KEY`). Wrangler prompts for the value; do not pass it on the command line.
3. In the sandbox Merchant Interface set **Account > Settings > Transaction Format Settings > Test Mode** to **OFF**. While Test Mode is on, Authorize.net approves everything with transaction id 0 and charges nothing; this app treats that as an error, never as a payment.
4. Register the webhook: **Account > Settings > Business Settings > Notifications/Webhooks** (Merchant Interface labels vary slightly by account; use the Webhooks page). Add an endpoint with URL `https://creditrepairparty.com/api/payments/authorize-net/webhook` and these events: `net.authorize.payment.authcapture.created`, `net.authorize.payment.fraud.approved`, `net.authorize.payment.fraud.declined`, `net.authorize.payment.fraud.held`, `net.authorize.payment.void.created`, `net.authorize.payment.refund.created`. Leave the endpoint active. The webhook only triggers a lookup: state changes come from `getTransactionDetails` matched to our invoice number, so a missed notification is reconciled with **Check status** in the CRM.
5. Confirm `AUTHNET_ENV` is `sandbox` in `wrangler.jsonc` vars, set `PAYMENTS_ENABLED` to `"true"`, and deploy. Apply the payment migrations (`20260929120000_payment_requests.sql`, then `20260929130000_payment_request_charge.sql`) before deploying code that depends on them, after taking a CRM backup.
6. QA on the deployed Worker with Authorize.net sandbox test cards only: an approved charge, a declined charge, and a hosted pay link. Then confirm the browser console shows no Content-Security-Policy violations while the AcceptUI lightbox opens. The CSP adds the AcceptUI script, frame and API origins only to signed-in `/crm` responses and only while payments are enabled with a valid `AUTHNET_ENV`; if the console reports a blocked Authorize.net origin, add that exact origin in `authorizeNetAcceptUiCspOrigins` in `src/lib/authorize-net-config.ts`, never a wildcard.

Manual-charge behaviour to know: the charge row is created before Authorize.net is called. A network or timeout failure is recorded as `charge_unknown` and shown as "unknown"; nothing retries it. Use **Check status** (or wait for the webhook) before charging again. Any open charge that has no recorded definite failure blocks new charges for that contact (409), however old it is (in-progress for the first 2 minutes, then unresolved), until staff use Check status or cancel it after confirming in Authorize.net that the card was not charged. This includes held charges and rows left by a Worker crash. Voids and refunds are done in the Authorize.net dashboard; the webhook records them.

Go live (separate, explicitly authorized step):

1. Create production credentials in the live Merchant Interface (Test Mode is not used in production) and register the same webhook against the live account with the live Signature Key.
2. Run `npx wrangler secret put` for all four `AUTHNET_*` secrets with the production values, set `AUTHNET_ENV` to `production` in `wrangler.jsonc` vars, and deploy from CI.
3. Never build or deploy from a machine that has production values in any `.env*` file. OpenNext bundles `.env*` files into the Worker, so a local production value could ship inside the bundle. Keep secrets only in Cloudflare Worker secrets.
4. Verify the first live charge with a small real amount, then refund it in Authorize.net.

To pause payments, set `PAYMENTS_ENABLED` back to `"false"` and redeploy; the CRM panel, the pay pages, the charge route and the webhook all fail closed.

## Before any planned deployment or database migration

1. Sign in to the CRM and open `https://vance-dotson.vancedotson.workers.dev/crm/settings`.
2. In **Backups**, click **Download CRM database backup (JSON)**.
3. Store the downloaded file somewhere private. It contains CRM data and must not be committed to Git or shared publicly. After the follow-up migration, backup v3 includes active-contact follow-up queue metadata, but excludes credit-report PDF files and upload receipt/session/attempt metadata; those files currently have no independent recovery guarantee. Take the current backup before migration and verify a new v3 export immediately afterward.
4. Confirm `https://vance-dotson.vancedotson.workers.dev/api/health` returns `{"ok":true}`.
5. Run the project tests, TypeScript check, lint, and production build.
6. Apply reviewed database migrations before deploying code that depends on them.

## Roll back a bad Worker deployment

From the project directory:

```powershell
npx.cmd wrangler versions list
npx.cmd wrangler rollback <KNOWN_GOOD_VERSION_ID>
```

Then verify:

1. Open the public health check and confirm it returns `{"ok":true}`.
2. Open the homepage and the signed-in CRM Overview.
3. Check Cloudflare Worker logs for new errors.

Important: a Worker rollback changes application code only. It does not reverse Supabase migrations or restore database records.

## Restore a CRM database backup

Only restore when the included CRM database records must be replaced by a known-good relational JSON snapshot. A v3 backup restores active-contact follow-up queue metadata; v1/v2 backups restore an empty queue, so transfer open obligations before using an older file. The admin-only contact privacy export also includes active-contact queue metadata. Neither export restores credit-report PDFs or upload receipt/session/attempt metadata, and the full backup must not be treated as complete report-file recovery.

1. First download a fresh backup of the current state, even if it may be damaged.
2. Open `https://vance-dotson.vancedotson.workers.dev/crm/settings`.
3. Under **Restore a CRM database backup**, choose the private JSON backup file.
4. Click **Validate backup**. Validation does not change data.
5. Check the displayed export time and record counts.
6. Type `RESTORE VANCE CRM` exactly.
7. Click **Restore this backup**.
8. Reload Contacts, Tasks, Calendar, Sequences, and System health.

The restore is transactional: it either completes or leaves the existing CRM unchanged. Pending or sending emails from the restored snapshot are cancelled so old messages are not sent accidentally.

## Credit-report artifact reconciliation

Credit-report uploads remain enabled and private. This operational path is available only after the reconciliation migration has been reviewed/applied and the matching application version is deployed. Do not apply migrations or run mutation requests as part of an incident check without the usual explicit approval.

The built-in maintenance cron invokes reconciliation with a fixed maximum batch of 25. It handles two exact-path work sets: attempts quiet for at least 24 hours with an expired 30-minute upload lease, and report objects queued as obsolete after a replacement receipt is prepared. Upload handlers renew their lease every five minutes while Storage is working. A recent or claimed attempt continues to block contact purge; uncertainty is fail-closed. Abandoned attempt rows are restricted tombstones and are checked again hourly to catch a late object completion. These minimal IDs/paths are retained as operational recovery state until a separately reviewed cleanup policy exists; they are not PDF bytes or a PDF retention policy.

An authorized signed-in CRM admin can inspect the next bounded batch without mutation by sending same-origin `POST /api/crm/credit-report-reconciliation` with JSON `{"dryRun":true,"limit":25}`. Dry-run reports aggregate counts only; it does not inspect Storage. To execute the bounded reconciliation, use `{"dryRun":false,"limit":25}` only after confirming the reported work is expected and an authorized operator approves the action. Limits outside 1–25 are rejected. The response and logs intentionally omit object keys, contact IDs, filenames, and provider error details. Staff, readonly users, and anonymous requests are denied. The existing internal maintenance path remains protected by `CRON_SECRET`.

The reconciler uses the Storage API only on the exact path already recorded in the protected attempt/obsolete queue. Before removal it checks that no current report receipt references that path; database finalization independently confirms the object is absent. A missing object is marked abandoned, never successful. Storage/database errors release the reconciliation claim for a later retry. If a failure persists, stop retries for that incident, preserve only the safe aggregate status/reason, and escalate to the application/database operator. Do not query/list customer objects manually, copy paths into logs, or mark an attempt complete by hand.

Contact purge blocks new sessions first, then reconciles eligible stale attempts. Recent/uncertain attempts still stop deletion. Do not bypass this blocker. A failed obsolete-object cleanup stays queued and is retried; the next purge also checks the entire exact contact prefix before database deletion.

## Credit-report recovery limitation

The downloadable CRM JSON is a relational database export, not a full-system backup. Version 3 includes active-contact follow-up queue metadata but excludes uploaded credit-report PDFs and upload receipt/session/attempt metadata. The project currently has no independent recovery guarantee for those files. Do not promise report-file restore or claim that the CRM export covers it. The follow-up migration does not add an external backup provider or change this limitation; a storage backup/recovery decision remains pending with the client.

## Database migration failure

Do not edit or delete an already-applied migration and do not attempt an unreviewed destructive reversal.

1. Stop the deployment if the migration has not been applied.
2. If it was applied, preserve a fresh CRM backup and record the migration filename and error.
3. Keep the currently working Worker version live when possible.
4. Prepare a new forward-only corrective migration.
5. Validate the correction against a non-production database before applying it to production.
6. If data must be replaced, use the validated CRM restore flow above.

## Incident response

### The whole site is unavailable

1. Check the **Production uptime** workflow in GitHub Actions.
2. Open the public health endpoint directly.
3. Inspect Cloudflare Worker logs for errors around the failure time.
4. If the incident started immediately after a deployment, roll back to the last known-good Worker version.
5. Recheck the health endpoint and one real public page.

### The site loads but CRM data fails

1. Open `https://vance-dotson.vancedotson.workers.dev/crm/health`.
2. Run the checks again.
3. If Database is unhealthy, avoid restores or destructive CRM actions until Supabase is responding.
4. Preserve the error time and Cloudflare log message without copying secret values.

### Email delivery fails

1. Open CRM **System health** and **Sequences**.
2. Check whether the queue is retrying or permanently failed.
3. Confirm the runtime `EMAIL_MODE`, `EMAIL_FROM`, and `EMAIL_REPLY_TO` settings are present and valid without copying values or secrets into logs or incident notes. The sender must be a Resend-authorized mailbox; booking replies are routed to the configured reply-to mailbox.
4. Public booking creation returns a generic 503 before rate limiting, calendar reservation, CRM writes, or automation unless `EMAIL_MODE` is exactly `production` and both sender and reply-to are valid. Do not switch modes as an incident workaround; test mode is an intentional pre-launch block.
5. Check Resend delivery status and Cloudflare Worker logs only when an authorized production delivery is already active.
6. Suppress a contact before retrying if sending to that person would be unsafe.
7. Do not resend restored pending messages automatically.

### Booking or Google Calendar fails

1. Open CRM **System health** and run the checks again.
2. Confirm Google Calendar status in System health. Calendar is an optional synchronization adapter; an unavailable calendar must not prevent app-owned availability or booking.
3. Check the booking alert and contact activity before asking the lead to retry. Provider-less bookings can still be rescheduled or cancelled in CRM.
4. Inspect Cloudflare logs without exposing calendar credentials or client details.

## Incident record

For every production incident, record:

- start and recovery times in America/Chicago;
- affected page or operation;
- Worker version before and after remediation;
- whether database data or email delivery was affected;
- the corrective action and verification result;
- any follow-up work needed to prevent recurrence.

Never paste passwords, API keys, access tokens, private backup contents, or personal client data into public issues or logs.
