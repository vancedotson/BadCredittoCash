import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), storageFrom: vi.fn(), list: vi.fn(), remove: vi.fn(), reconcile: vi.fn() }));
vi.mock("./supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, storage: { from: mocks.storageFrom } }) }));
vi.mock("./credit-report-reconciliation", () => ({ reconcileCreditReportArtifacts: mocks.reconcile }));

import { purgeContact } from "./contact-privacy";

const contactId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

describe("permanent credit report deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.reconcile.mockResolvedValue({ failed: 0 });
    mocks.rpc.mockImplementation(async (name: string) => name === "begin_credit_report_purge_v1"
      ? { data: { found: true, pending: 0 }, error: null }
      : { data: true, error: null });
    mocks.storageFrom.mockReturnValue({ list: mocks.list, remove: mocks.remove });
    mocks.list.mockResolvedValue({ data: [], error: null });
    mocks.remove.mockResolvedValue({ error: null });
  });

  it("revokes upload sessions before enumerating and deleting all contact-prefix bytes", async () => {
    mocks.list.mockImplementation(async (prefix: string) => ({ data: prefix === contactId
      ? [{ name: sessionId, id: null }]
      : [{ name: "current.pdf", id: "object-a" }, { name: "orphaned.pdf", id: "object-b" }], error: null }));
    expect(await purgeContact(contactId)).toBe(true);
    expect(mocks.rpc.mock.calls[0]).toEqual(["begin_credit_report_purge_v1", { p_contact_id: contactId }]);
    expect(mocks.storageFrom).toHaveBeenCalledWith("credit-reports");
    expect(mocks.remove).toHaveBeenCalledWith([`${contactId}/${sessionId}/current.pdf`, `${contactId}/${sessionId}/orphaned.pdf`]);
    expect(mocks.rpc.mock.calls[1]).toEqual(["purge_crm_contact_v1", { p_contact_id: contactId }]);
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.list.mock.invocationCallOrder[0]);
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[1]);
  });

  it("preserves the contact and metadata while an upload outcome is pending", async () => {
    mocks.rpc.mockResolvedValue({ data: { found: true, pending: 1 }, error: null });
    await expect(purgeContact(contactId)).rejects.toThrow("still finishing");
    expect(mocks.reconcile).toHaveBeenCalledWith({ limit: 25, contactId });
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("reconciles stale attempts after purge revocation, then continues only when no pending attempt remains", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "begin_credit_report_purge_v1") {
        return { data: { found: true, pending: mocks.rpc.mock.calls.filter(([called]) => called === name).length === 1 ? 1 : 0 }, error: null };
      }
      if (name === "purge_crm_contact_v1") return { data: true, error: null };
      return { data: true, error: null };
    });
    expect(await purgeContact(contactId)).toBe(true);
    expect(mocks.reconcile).toHaveBeenCalledWith({ limit: 25, contactId });
    expect(mocks.storageFrom).toHaveBeenCalledWith("credit-reports");
    expect(mocks.rpc.mock.calls.at(-1)?.[0]).toBe("purge_crm_contact_v1");
  });

  it("does not report success or erase metadata if Storage refuses a file deletion", async () => {
    mocks.list.mockResolvedValue({ data: [{ name: "orphan.pdf", id: "object" }], error: null });
    mocks.remove.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(purgeContact(contactId)).rejects.toThrow("could not be deleted");
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("does not delete CRM records when file enumeration fails", async () => {
    mocks.list.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(purgeContact(contactId)).rejects.toThrow("Could not list report files");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it("fails closed when the lifecycle migration is missing", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "missing function" } });
    await expect(purgeContact(contactId)).rejects.toThrow("Could not prepare report deletion");
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });

  it("refuses unsafe contact prefixes or unexpected Storage paths", async () => {
    await expect(purgeContact("../other-contact")).rejects.toThrow("Invalid contact");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.list.mockResolvedValue({ data: [{ name: "../other", id: "object" }], error: null });
    await expect(purgeContact(contactId)).rejects.toThrow("unexpected report path");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("keeps revocation in place and surfaces final database failure for retry", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "begin_credit_report_purge_v1"
      ? { data: { found: true, pending: 0 }, error: null }
      : { data: null, error: { message: "credit_report_files_not_deleted" } });
    await expect(purgeContact(contactId)).rejects.toThrow("Could not permanently delete contact");
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("returns not found without touching Storage for a nonexistent contact", async () => {
    mocks.rpc.mockResolvedValue({ data: { found: false, pending: 0 }, error: null });
    expect(await purgeContact(contactId)).toBe(false);
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });
});
