import "server-only";

import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { CREDIT_REPORT_BUREAUS, type CreditReportBureau } from "./credit-report-validation";
import type { CreditReportReceipt, CreditReportSession } from "./credit-reports";

type StoredReport = CreditReportReceipt & { objectPath: string };
function root() {
  if (process.env.NODE_ENV !== "development") throw new Error("Local report storage is development-only.");
  return join(process.cwd(), ".local", "credit-check-reports");
}
async function writeDurable(path: string, data: string | Uint8Array) {
  const file = await open(path, "wx", 0o600);
  try { await file.writeFile(data); await file.sync(); } finally { await file.close(); }
}
async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function createLocalReportSession(session: CreditReportSession): Promise<void> {
  // A session is issued only for an intake already durably written by this app.
  const intake = await readJson<{ id: string }>(join(process.cwd(), ".local", "credit-check", `${session.submissionId}.json`));
  if (intake?.id !== session.submissionId) throw new Error("Credit-check intake is missing.");
  const directory = join(root(), "sessions");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeDurable(join(directory, `${session.tokenHash}.json`), JSON.stringify(session));
}
export async function findLocalReportSession(tokenHash: string) {
  return readJson<CreditReportSession>(join(root(), "sessions", `${tokenHash}.json`));
}
export async function listLocalCreditReports(session: CreditReportSession): Promise<CreditReportReceipt[]> {
  const records = await Promise.all(CREDIT_REPORT_BUREAUS.map((bureau) =>
    readJson<StoredReport>(join(root(), session.id, `${bureau}.json`))));
  return records.filter((record): record is StoredReport => record !== null)
    .map(({ id, submissionId, bureau, fileName, uploadedAt, byteSize }) => ({ id, submissionId, bureau, fileName, uploadedAt, byteSize }));
}
export async function saveLocalCreditReport(session: CreditReportSession, bureau: CreditReportBureau, fileName: string, bytes: Uint8Array): Promise<CreditReportReceipt> {
  const directory = join(root(), session.id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const objectPath = `${id}.pdf`;
  const manifestPath = join(directory, `${bureau}.json`);
  const previous = await readJson<StoredReport>(manifestPath);
  const receipt: CreditReportReceipt = { id, submissionId: session.submissionId, bureau, fileName, byteSize: bytes.byteLength, uploadedAt: new Date().toISOString() };
  const temporary = join(directory, `${id}.json.tmp`);
  try {
    await writeDurable(join(directory, objectPath), bytes);
    await writeDurable(temporary, JSON.stringify({ ...receipt, objectPath }));
    // Commit last: failed replacement leaves the previous file and receipt intact.
    await rename(temporary, manifestPath);
  } catch (error) {
    await Promise.allSettled([unlink(temporary), unlink(join(directory, objectPath))]);
    throw error;
  }
  if (previous) await unlink(join(directory, previous.objectPath)).catch(() => {});
  return receipt;
}
