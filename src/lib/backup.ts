import "server-only";

import { createAdminClient } from "./supabase/admin";

export const CRM_BACKUP_FORMAT = "vance-crm-backup";
export const CRM_BACKUP_VERSION = 1;

export const CRM_BACKUP_TABLES = [
  "contacts", "events", "notes", "tasks", "tags", "contact_tags",
  "bookings", "sequence_enrollments", "scheduled_messages", "settings",
] as const;

type BackupTable = (typeof CRM_BACKUP_TABLES)[number];
type BackupRow = Record<string, unknown>;

export type CrmBackup = {
  format: typeof CRM_BACKUP_FORMAT;
  version: typeof CRM_BACKUP_VERSION;
  exportedAt: string;
  tables: Record<BackupTable, BackupRow[]>;
};

export async function createCrmBackup(): Promise<CrmBackup> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("export_crm_backup_v1");
  if (error) throw new Error(`Could not create the CRM backup: ${error.message}`);
  const validation = validateCrmBackup(data);
  if (!validation.backup) throw new Error(validation.error ?? "The database returned an invalid backup.");
  return validation.backup;
}

export function validateCrmBackup(value: unknown): { backup?: CrmBackup; error?: string; counts?: Record<string, number> } {
  if (!value || typeof value !== "object") return { error: "This is not a Vance CRM backup file." };
  const candidate = value as Partial<CrmBackup>;
  if (candidate.format !== CRM_BACKUP_FORMAT || candidate.version !== CRM_BACKUP_VERSION) return { error: "Unsupported backup format or version." };
  if (!candidate.tables || typeof candidate.tables !== "object") return { error: "The backup has no table data." };
  const counts: Record<string, number> = {};
  for (const table of CRM_BACKUP_TABLES) {
    const rows = candidate.tables[table];
    if (!Array.isArray(rows)) return { error: `The ${table} table is missing or invalid.` };
    if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return { error: `The ${table} table contains an invalid row.` };
    counts[table] = rows.length;
  }
  return { backup: candidate as CrmBackup, counts };
}
