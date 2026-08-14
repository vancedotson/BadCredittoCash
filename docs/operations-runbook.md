# Vance Dotson operations runbook

Use this guide when deploying, backing up, restoring, or responding to a production problem.

Production application: `https://vance-dotson.anadias-dev.workers.dev`

Public health check: `https://vance-dotson.anadias-dev.workers.dev/api/health`

## Before any planned deployment or database migration

1. Sign in to the CRM and open `https://vance-dotson.anadias-dev.workers.dev/crm/settings`.
2. In **Backups**, click **Download full backup (JSON)**.
3. Store the downloaded file somewhere private. It contains client CRM data and must not be committed to Git or shared publicly.
4. Confirm `https://vance-dotson.anadias-dev.workers.dev/api/health` returns `{"ok":true}`.
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

## Restore a CRM backup

Only restore when current CRM data must be replaced by a known-good full backup.

1. First download a fresh backup of the current state, even if it may be damaged.
2. Open `https://vance-dotson.anadias-dev.workers.dev/crm/settings`.
3. Under **Restore a full backup**, choose the private JSON backup file.
4. Click **Validate backup**. Validation does not change data.
5. Check the displayed export time and record counts.
6. Type `RESTORE VANCE CRM` exactly.
7. Click **Restore this backup**.
8. Reload Contacts, Tasks, Calendar, Sequences, and System health.

The restore is transactional: it either completes or leaves the existing CRM unchanged. Pending or sending emails from the restored snapshot are cancelled so old messages are not sent accidentally.

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

1. Open `https://vance-dotson.anadias-dev.workers.dev/crm/health`.
2. Run the checks again.
3. If Database is unhealthy, avoid restores or destructive CRM actions until Supabase is responding.
4. Preserve the error time and Cloudflare log message without copying secret values.

### Email delivery fails

1. Open CRM **System health** and **Sequences**.
2. Check whether the queue is retrying or permanently failed.
3. Check Resend delivery status and Cloudflare Worker logs.
4. Suppress a contact before retrying if sending to that person would be unsafe.
5. Do not resend restored pending messages automatically.

### Booking or Google Calendar fails

1. Open CRM **System health** and run the checks again.
2. Confirm Google Calendar reports Healthy.
3. Check the booking alert and contact activity before asking the lead to retry.
4. Inspect Cloudflare logs without exposing calendar credentials or client details.

## Incident record

For every production incident, record:

- start and recovery times in Europe/Lisbon;
- affected page or operation;
- Worker version before and after remediation;
- whether database data or email delivery was affected;
- the corrective action and verification result;
- any follow-up work needed to prevent recurrence.

Never paste passwords, API keys, access tokens, private backup contents, or personal client data into public issues or logs.
