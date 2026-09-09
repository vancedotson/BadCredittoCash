import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { findCreditReportSession, hashReportToken, issueCreditReportSession, listCreditReports, saveCreditReport } from "./credit-reports";

const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n");
let directory: string;
let submissionId: string;
describe("private local credit-report persistence", () => {
  beforeEach(async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("SUPABASE_SECRET_KEY", "");
    directory = await mkdtemp(join(tmpdir(), "vance-report-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    submissionId = randomUUID();
    await mkdir(join(directory, ".local", "credit-check"), { recursive: true });
    await writeFile(join(directory, ".local", "credit-check", `${submissionId}.json`), JSON.stringify({ id: submissionId }));
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

  it("issues a random capability only after intake and persists only its hash", async () => {
    await expect(issueCreditReportSession({ id: randomUUID(), mode: "local" })).rejects.toThrow("intake is missing");
    const issued = await issueCreditReportSession({ id: submissionId, mode: "local" });
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const files = await readdir(join(directory, ".local", "credit-check-reports", "sessions"));
    expect(files).toEqual([`${hashReportToken(issued.token)}.json`]);
    const saved = await readFile(join(directory, ".local", "credit-check-reports", "sessions", files[0]), "utf8");
    expect(saved).not.toContain(issued.token);
    expect(await findCreditReportSession(issued.token)).toMatchObject({ submissionId, mode: "local" });
    expect(await findCreditReportSession("z".repeat(43))).toBeNull();
  });

  it("persists receipts for three independent files and restores them from disk", async () => {
    const { token } = await issueCreditReportSession({ id: submissionId, mode: "local" });
    const session = (await findCreditReportSession(token))!;
    for (const bureau of ["transunion", "equifax", "experian"] as const) await saveCreditReport(session, bureau, `${bureau}.pdf`, pdf);
    const restored = (await findCreditReportSession(token))!;
    const reports = await listCreditReports(restored);
    expect(reports.map((report) => report.bureau)).toEqual(["transunion", "equifax", "experian"]);
    const stored = new Uint8Array(await readFile(join(directory, ".local", "credit-check-reports", session.id, `${reports[0].id}.pdf`)));
    expect(stored).toEqual(pdf);
    expect(reports[0]).not.toHaveProperty("objectPath");
  });

  it("preserves a previous receipt on invalid replacement and atomically replaces valid files", async () => {
    const { token } = await issueCreditReportSession({ id: submissionId, mode: "local" });
    const session = (await findCreditReportSession(token))!;
    const first = await saveCreditReport(session, "equifax", "first.pdf", pdf);
    await expect(saveCreditReport(session, "equifax", "bad.pdf", new Uint8Array(30))).rejects.toThrow();
    expect(await listCreditReports(session)).toEqual([first]);
    const replacement = await saveCreditReport(session, "equifax", "second.pdf", pdf);
    expect(replacement.id).not.toBe(first.id);
    expect(await listCreditReports(session)).toEqual([replacement]);
    expect(await readdir(join(directory, ".local", "credit-check-reports", session.id))).toEqual(expect.arrayContaining(["equifax.json", `${replacement.id}.pdf`]));
    await expect(readFile(join(directory, ".local", "credit-check-reports", session.id, `${first.id}.pdf`))).rejects.toThrow();
  });

  it("rejects expired capabilities and never falls back to local storage in production", async () => {
    const { token } = await issueCreditReportSession({ id: submissionId, mode: "local" });
    const session = (await findCreditReportSession(token))!;
    session.expiresAt = new Date(Date.now() - 1000).toISOString();
    await writeFile(join(directory, ".local", "credit-check-reports", "sessions", `${session.tokenHash}.json`), JSON.stringify(session));
    expect(await findCreditReportSession(token)).toBeNull();
    await expect(saveCreditReport(session, "transunion", "report.pdf", pdf)).rejects.toThrow();
    vi.stubEnv("NODE_ENV", "production");
    await expect(findCreditReportSession(token)).rejects.toThrow("not configured");
  });
});
