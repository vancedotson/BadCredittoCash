import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLeadMagnetWorkspace } from "./lead-magnet";
import { normalizeLeadMagnetQuery } from "./lead-magnet-types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn(), contacts: vi.fn(), privateRead: vi.fn() }));
vi.mock("./supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./store", () => ({ listContacts: mocks.contacts }));
vi.mock("./credit-check-local", () => ({ saveLocalCreditCheckSubmission: mocks.privateRead }));
vi.mock("./credit-reports-local", () => ({ listLocalCreditReports: mocks.privateRead, findLocalReportSession: mocks.privateRead }));

const report = { id: "report-id", submissionId: "intake-id", bureau: "equifax", fileName: "equifax.pdf", uploadedAt: "2026-09-10T12:00:00Z", byteSize: 1024 };
const row = { contactId: "contact-id", name: "Sample Person", email: "sample@example.test", phone: null, owner: null, stage: "won", companies: ["Midland Credit Management"], firstSubmittedAt: "2026-07-10T12:00:00Z", lastSubmittedAt: "2026-09-10T12:00:00Z", submissionCount: 2, reports: [report] };
function response() {
  return { rows: [structuredClone(row)], total: 1, page: 1, pageSize: 25, summary: { totalSignups: 1501, newLast30Days: 25, waiting: 500, partial: 1000, complete: 1 } };
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VANCE_ENABLE_DEMO_DATA", "false");
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: response(), error: null });
  mocks.contacts.mockResolvedValue({ rows: [
    { id: "lead_1016", name: "Evan Wright", email: "evan@example.com", stage: "registered" },
    { id: "lead_1009", name: "Grace Okafor", email: "grace@example.com", stage: "booked", owner: "Vance" },
    { id: "lead_1001", name: "Ana Martins", email: "ana@example.com", stage: "won", owner: "Vance" },
  ] });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("lead magnet query normalization", () => {
  it("defaults invalid URL shapes and bounds long search and pagination", () => {
    expect(normalizeLeadMagnetQuery()).toEqual({ search: "", status: "all", page: 1, pageSize: 25 });
    expect(normalizeLeadMagnetQuery({ search: ["private"], status: "unknown", page: "1.5", pageSize: "-2" })).toEqual({ search: "", status: "all", page: 1, pageSize: 25 });
    expect(normalizeLeadMagnetQuery({ search: `  ${"a".repeat(250)}  `, status: "partial", page: Infinity, pageSize: 900 })).toEqual({ search: "a".repeat(200), status: "partial", page: 1, pageSize: 100 });
    expect(normalizeLeadMagnetQuery({ page: "2", pageSize: "50" })).toMatchObject({ page: 2, pageSize: 50 });
  });
  it("keeps punctuation as literal search data", () => {
    expect(normalizeLeadMagnetQuery({ search: "  50%_off@example.test  " }).search).toBe("50%_off@example.test");
  });
});

describe("authenticated lead magnet reader", () => {
  it("uses one authenticated aggregate RPC and preserves global counts independent of filtered rows", async () => {
    const result = await getLeadMagnetWorkspace({ search: " Sample ", status: "partial", pageSize: 25 });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_lead_magnet_workspace_v1", { p_search: "Sample", p_status: "partial", p_page: 1, p_page_size: 25 });
    expect(result).toMatchObject({ total: 1, demo: false, summary: { totalSignups: 1501, partial: 1000 } });
    expect(result.rows[0]).toMatchObject({ stage: "won", submissionCount: 2, reports: [report] });
    expect(mocks.contacts).not.toHaveBeenCalled();
  });
  it("allowlists metadata so storage paths and capabilities never reach the UI", async () => {
    const data = response();
    Object.assign(data.rows[0], { token: "secret", properties: { private: true } });
    Object.assign(data.rows[0].reports[0], { object_path: "private/contact.pdf", token_hash: "private-capability" });
    Object.assign(data, { privateFiles: ["private/contact.pdf"], demo: true });
    mocks.rpc.mockResolvedValue({ data, error: null });
    const result = await getLeadMagnetWorkspace();
    expect(JSON.stringify(result)).not.toMatch(/secret|private|token|object_path/);
    expect(result.demo).toBe(false);
    expect(result.rows[0]).not.toHaveProperty("phone");
  });
  it("normalizes the existing booking RPC's call_booked stage alias", async () => {
    const data = response(); data.rows[0].stage = "call_booked";
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect((await getLeadMagnetWorkspace()).rows[0].stage).toBe("booked");
  });
  it.each([null, "", "legacy-unknown"])("uses the existing contacts fallback for unrecognized stages (%s)", async (stage) => {
    const data = response(); Object.assign(data.rows[0], { stage });
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect((await getLeadMagnetWorkspace()).rows[0].stage).toBe("new");
  });
  it("propagates database failure without disclosing internals or substituting demo records", async () => {
    mocks.rpc.mockResolvedValue({ data: response(), error: { message: "relation private_token_table missing" } });
    await expect(getLeadMagnetWorkspace()).rejects.toThrow("Lead magnet signups could not be loaded.");
    expect(mocks.contacts).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...response(), rows: [] , summary: { totalSignups: "1501" } }])("rejects malformed aggregate responses instead of showing a false empty state", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getLeadMagnetWorkspace()).rejects.toThrow("could not be loaded");
  });
  it("rejects duplicate bureau receipts, invalid report types and oversized pages", async () => {
    const duplicated = response(); duplicated.rows[0].reports.push({ ...report });
    mocks.rpc.mockResolvedValueOnce({ data: duplicated, error: null });
    await expect(getLeadMagnetWorkspace()).rejects.toThrow("could not be loaded");
    const invalid = response(); invalid.rows[0].reports[0].bureau = "other";
    mocks.rpc.mockResolvedValueOnce({ data: invalid, error: null });
    await expect(getLeadMagnetWorkspace()).rejects.toThrow("could not be loaded");
    mocks.rpc.mockResolvedValueOnce({ data: { ...response(), pageSize: 101 }, error: null });
    await expect(getLeadMagnetWorkspace()).rejects.toThrow("could not be loaded");
  });
  it("does not use demo or local storage in production even if the demo flag is set", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("VANCE_ENABLE_DEMO_DATA", "true");
    expect((await getLeadMagnetWorkspace()).demo).toBe(false);
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.contacts).not.toHaveBeenCalled();
    expect(mocks.privateRead).not.toHaveBeenCalled();
  });
});

describe("explicit fictional preview", () => {
  beforeEach(() => {
    vi.stubEnv("VANCE_ENABLE_DEMO_DATA", "true");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-12T12:00:00Z"));
  });
  it("shows one row per fictional person, three receipt states, and first-intake counts", async () => {
    const result = await getLeadMagnetWorkspace();
    expect(result.summary).toEqual({ totalSignups: 3, newLast30Days: 2, waiting: 1, partial: 1, complete: 1 });
    expect(result.rows.map((item) => [item.contactId, item.reports.length, item.submissionCount])).toEqual([["lead_1016", 0, 1], ["lead_1009", 2, 2], ["lead_1001", 3, 2]]);
    expect(result.demo).toBe(true);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.privateRead).not.toHaveBeenCalled();
  });
  it("filters and paginates fictional rows without changing the global summary", async () => {
    const filtered = await getLeadMagnetWorkspace({ search: "GRACE@", status: "partial", page: 999 });
    expect(filtered).toMatchObject({ total: 1, page: 1, summary: { totalSignups: 3, complete: 1 } });
    expect(filtered.rows.map((item) => item.email)).toEqual(["grace@example.com"]);
    const paged = await getLeadMagnetWorkspace({ page: 2, pageSize: 1 });
    expect(paged.rows[0].name).toBe("Grace Okafor");
    expect(paged.total).toBe(3);
    const none = await getLeadMagnetWorkspace({ search: "%" });
    expect(none).toMatchObject({ rows: [], total: 0, page: 1, summary: { totalSignups: 3 } });
  });
});
