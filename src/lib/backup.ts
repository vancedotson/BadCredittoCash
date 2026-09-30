import "server-only";

import { createAdminClient } from "./supabase/admin";

export const CRM_BACKUP_FORMAT = "vance-crm-backup";
export const CRM_BACKUP_VERSION = 4;

export const CRM_BACKUP_TABLES = [
  "contacts", "events", "notes", "tasks", "tags", "contact_tags",
  "bookings", "sequence_enrollments", "scheduled_messages", "settings",
  "live_webinar_sessions", "live_webinar_registrations",
  "credit_report_followup_obligations", "credit_report_followup_receipts",
  "credit_report_followup_contact_attempts", "credit_report_followup_audit",
  "payment_requests", "payment_request_events",
] as const;

type BackupTable = (typeof CRM_BACKUP_TABLES)[number];
type BackupRow = Record<string, unknown>;

export type CrmBackup = {
  format: typeof CRM_BACKUP_FORMAT;
  version: 1 | 2 | 3 | typeof CRM_BACKUP_VERSION;
  exportedAt: string;
  tables: Record<BackupTable, BackupRow[]>;
};

export async function createCrmBackup(): Promise<CrmBackup> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("export_crm_backup_v4");
  if (error) throw new Error(`Could not create the CRM backup: ${error.message}`);
  const validation = validateCrmBackup(data);
  if (!validation.backup) throw new Error(validation.error ?? "The database returned an invalid backup.");
  return validation.backup;
}

export function validateCrmBackup(value: unknown): { backup?: CrmBackup; error?: string; counts?: Record<string, number> } {
  if (!value || typeof value !== "object") return { error: "This is not a Vance CRM backup file." };
  const candidate = value as Partial<Omit<CrmBackup, "version">> & { version?: number };
  if (candidate.format !== CRM_BACKUP_FORMAT || (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3 && candidate.version !== CRM_BACKUP_VERSION)) return { error: "Unsupported backup format or version." };
  if (!candidate.tables || typeof candidate.tables !== "object") return { error: "The backup has no table data." };
  const counts: Record<string, number> = {};
  for (const table of CRM_BACKUP_TABLES) {
    const legacyQueueTable = table.startsWith("credit_report_followup_") && candidate.version < 3;
    const legacyPaymentTable = table.startsWith("payment_") && candidate.version < 4;
    const legacyWebinarTable = table.startsWith("live_webinar_") && candidate.version === 1;
    const rows = candidate.tables[table] ?? (legacyQueueTable || legacyWebinarTable || legacyPaymentTable ? [] : undefined);
    if (!Array.isArray(rows)) return { error: `The ${table} table is missing or invalid.` };
    if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return { error: `The ${table} table contains an invalid row.` };
    counts[table] = rows.length;
  }
  // Keep the original version for the database's tested legacy upgrade path.
  return { backup: {
    ...candidate,
    tables: {
      ...candidate.tables,
      live_webinar_sessions: candidate.tables.live_webinar_sessions ?? [],
      live_webinar_registrations: candidate.tables.live_webinar_registrations ?? [],
      credit_report_followup_obligations: candidate.tables.credit_report_followup_obligations ?? [],
      credit_report_followup_receipts: candidate.tables.credit_report_followup_receipts ?? [],
      credit_report_followup_contact_attempts: candidate.tables.credit_report_followup_contact_attempts ?? [],
      credit_report_followup_audit: candidate.tables.credit_report_followup_audit ?? [],
      payment_requests: candidate.tables.payment_requests ?? [],
      payment_request_events: candidate.tables.payment_request_events ?? [],
    },
  } as CrmBackup, counts };
}
