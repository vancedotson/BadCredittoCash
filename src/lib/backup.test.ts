import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("./supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import {
  CRM_BACKUP_FORMAT,
  CRM_BACKUP_VERSION,
  createCrmBackup,
  type CrmBackup,
  validateCrmBackup,
} from "./backup";

function validBackup(): CrmBackup {
  return {
    format: CRM_BACKUP_FORMAT,
    version: CRM_BACKUP_VERSION,
    exportedAt: "2026-08-13T12:00:00.000Z",
    tables: {
      contacts: [], events: [], notes: [], tasks: [], tags: [], contact_tags: [],
      bookings: [], sequence_enrollments: [], scheduled_messages: [], settings: [],
    },
  };
}

describe("CRM backup repository integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests the transactional export RPC and returns a validated backup", async () => {
    const backup = validBackup();
    backup.tables.contacts.push({ id: "contact_1" });
    mocks.rpc.mockResolvedValue({ data: backup, error: null });

    await expect(createCrmBackup()).resolves.toEqual(backup);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("export_crm_backup_v1");
  });

  it("surfaces database export failures without returning partial data", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    await expect(createCrmBackup()).rejects.toThrow("Could not create the CRM backup: database unavailable");
  });

  it("rejects malformed data returned by the database", async () => {
    mocks.rpc.mockResolvedValue({ data: { format: CRM_BACKUP_FORMAT, version: CRM_BACKUP_VERSION }, error: null });
    await expect(createCrmBackup()).rejects.toThrow("The backup has no table data.");
  });
});

describe("CRM backup validation", () => {
  it("reports table counts for a complete backup", () => {
    const backup = validBackup();
    backup.tables.contacts.push({ id: "contact_1" });
    backup.tables.tasks.push({ id: "task_1" }, { id: "task_2" });

    const result = validateCrmBackup(backup);
    expect(result.backup).toEqual(backup);
    expect(result.counts?.contacts).toBe(1);
    expect(result.counts?.tasks).toBe(2);
  });

  it.each([
    [null, "This is not a Vance CRM backup file."],
    [{ format: "other", version: 1 }, "Unsupported backup format or version."],
    [{ ...validBackup(), tables: { ...validBackup().tables, contacts: "not rows" } }, "The contacts table is missing or invalid."],
    [{ ...validBackup(), tables: { ...validBackup().tables, contacts: [null] } }, "The contacts table contains an invalid row."],
  ])("rejects unsafe backup input", (value, expectedError) => {
    expect(validateCrmBackup(value).error).toBe(expectedError);
  });
});
