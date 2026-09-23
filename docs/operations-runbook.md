# Vance Dotson operations runbook

Use this guide when deploying, backing up, restoring, or responding to a production problem.

Production application: `https://vance-dotson.vancedotson.workers.dev`

Public health check: `https://vance-dotson.vancedotson.workers.dev/api/health`

## Before any planned deployment or database migration

1. Sign in to the CRM and open `https://vance-dotson.vancedotson.workers.dev/crm/settings`.
2. In **Backups**, click **Download CRM database backup (JSON)**.
3. Store the downloaded file somewhere private. It contains CRM data and must not be committed to Git or shared publicly. This relational snapshot excludes credit-report PDF files and their report metadata; those files currently have no independent recovery guarantee.
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

Only restore when the included CRM database records must be replaced by a known-good relational JSON snapshot. This restore does not restore credit-report PDFs or their report metadata, and must not be treated as a complete application or report-file recovery.

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

The downloadable CRM JSON is a relational database export, not a full-system backup. It excludes uploaded credit-report PDFs and the related receipt/session/attempt metadata. The project currently has no independent recovery guarantee for those files. Do not promise report-file restore or claim that the CRM export covers it. The database migration does not add an external backup provider or change this limitation; a storage backup/recovery decision remains pending with the client.

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
