import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "./supabase/admin";
import { hasCreditCheckDatabaseConfig, isCreditCheckLocalMode } from "./credit-check";
import { isCreditReportBureau, isPdfFile, type CreditReportBureau } from "./credit-report-validation";
export type { CreditReportBureau } from "./credit-report-validation";

export const CREDIT_REPORT_COOKIE = "vance_report_upload";
export const CREDIT_REPORT_SESSION_SECONDS = 7 * 24 * 60 * 60;
const BUCKET = "credit-reports";
export type CreditReportReceipt = { id: string; submissionId: string; bureau: CreditReportBureau; fileName: string; uploadedAt: string; byteSize: number };
export type CreditReportSession = { id: string; submissionId: string; contactId: string | null; tokenHash: string; expiresAt: string; mode: "local" | "live" };
type ReportRow = { id: string; submission_id: string; bureau: CreditReportBureau; file_name: string; uploaded_at: string; byte_size: number; object_path?: string };
function receipt(row: ReportRow): CreditReportReceipt {
  return { id: row.id, submissionId: row.submission_id, bureau: row.bureau, fileName: row.file_name, uploadedAt: row.uploaded_at, byteSize: row.byte_size };
}
function requireDatabase() { if (!hasCreditCheckDatabaseConfig()) throw new Error("Credit report storage is not configured."); }
export function isReportToken(token: string): boolean { return /^[A-Za-z0-9_-]{43}$/.test(token); }
export function hashReportToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function reportTokenFromRequest(request: Request): string | null {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CREDIT_REPORT_COOKIE}=`))?.slice(CREDIT_REPORT_COOKIE.length + 1);
  return token && isReportToken(token) ? token : null;
}
export function reportSessionCookie(token: string, request: Request, expiresAt?: string): string {
  const secure = process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
  const maxAge = expiresAt ? Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)) : CREDIT_REPORT_SESSION_SECONDS;
  return `${CREDIT_REPORT_COOKIE}=${token}; Path=/api/credit-check; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
export async function issueCreditReportSession(submission: { id: string; mode: "local" | "live" }): Promise<{ token: string; expiresAt: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(submission.id)) throw new Error("Invalid intake identifier.");
  const token = randomBytes(32).toString("base64url");
  const session: CreditReportSession = { id: randomUUID(), submissionId: submission.id, contactId: null, tokenHash: hashReportToken(token), expiresAt: new Date(Date.now() + CREDIT_REPORT_SESSION_SECONDS * 1000).toISOString(), mode: submission.mode };
  if (isCreditCheckLocalMode() && submission.mode === "local") {
    await (await import("./credit-reports-local")).createLocalReportSession(session);
  } else {
    requireDatabase();
    if (submission.mode !== "live") throw new Error("Invalid report storage mode.");
    const supabase = createAdminClient();
    const { data: event, error: eventError } = await supabase.from("events").select("contact_id").eq("id", submission.id).eq("event_key", "credit_check_submitted").single();
    if (eventError || !event?.contact_id) throw new Error("Credit-check intake is missing.");
    const { error } = await supabase.from("credit_report_upload_sessions").insert({ id: session.id, submission_id: session.submissionId, contact_id: event.contact_id, token_hash: session.tokenHash, expires_at: session.expiresAt });
    if (error) throw new Error("Could not prepare report uploads.");
  }
  return { token, expiresAt: session.expiresAt };
}
export async function findCreditReportSession(token: string): Promise<CreditReportSession | null> {
  if (!isReportToken(token)) return null;
  const tokenHash = hashReportToken(token);
  let session: CreditReportSession | null;
  if (isCreditCheckLocalMode()) {
    session = await (await import("./credit-reports-local")).findLocalReportSession(tokenHash);
  } else {
    requireDatabase();
    const { data, error } = await createAdminClient().from("credit_report_upload_sessions").select("id,submission_id,contact_id,token_hash,expires_at").eq("token_hash", tokenHash).maybeSingle();
    if (error) throw new Error("Report session lookup failed.");
    session = data ? { id: data.id, submissionId: data.submission_id, contactId: data.contact_id, tokenHash: data.token_hash, expiresAt: data.expires_at, mode: "live" } : null;
    if (session) {
      const { data: contact, error: contactError } = await createAdminClient().from("contacts").select("id").eq("id", session.contactId).maybeSingle();
      if (contactError) throw new Error("Report contact lookup failed.");
      // Contact trash removes the active contact. Retained metadata is not an
      // authorization grant; a restored active contact can resume until expiry.
      if (!contact) return null;
      const { data: purgeBlock, error: purgeError } = await createAdminClient().from("credit_report_purge_blocks").select("contact_id").eq("contact_id", session.contactId).maybeSingle();
      if (purgeError) throw new Error("Report availability lookup failed.");
      if (purgeBlock) return null;
    }
  }
  return session && Date.parse(session.expiresAt) > Date.now() ? session : null;
}
export async function listCreditReports(session: CreditReportSession): Promise<CreditReportReceipt[]> {
  if (session.mode === "local" && isCreditCheckLocalMode()) return (await import("./credit-reports-local")).listLocalCreditReports(session);
  requireDatabase();
  const { data, error } = await createAdminClient().from("credit_report_uploads").select("id,submission_id,bureau,file_name,uploaded_at,byte_size").eq("session_id", session.id);
  if (error) throw new Error("Report receipts could not be read.");
  return (data ?? []).map(receipt);
}
export async function saveCreditReport(session: CreditReportSession, bureau: CreditReportBureau, fileName: string, bytes: Uint8Array): Promise<CreditReportReceipt> {
  if (!isCreditReportBureau(bureau) || !isPdfFile(bytes) || Date.parse(session.expiresAt) <= Date.now()) throw new Error("Invalid or expired report upload.");
  if (session.mode === "local" && isCreditCheckLocalMode()) return (await import("./credit-reports-local")).saveLocalCreditReport(session, bureau, fileName, bytes);
  requireDatabase();
  const supabase = createAdminClient();
  if (!session.contactId) throw new Error("Report contact is unavailable.");
  const { data: previous, error: previousError } = await supabase.from("credit_report_uploads").select("object_path").eq("session_id", session.id).eq("bureau", bureau).maybeSingle();
  if (previousError) throw new Error("Report storage is unavailable.");
  const id = randomUUID();
  const objectPath = `${session.contactId}/${session.id}/${id}.pdf`;
  // Registration and purge take the same database lock. A purge cannot claim
  // files are gone while a registered storage request could still write one.
  const { data: begun, error: beginError } = await supabase.rpc("begin_credit_report_upload_v1", { p_attempt_id: id, p_session_id: session.id, p_object_path: objectPath });
  if (beginError || begun !== true) throw new Error("Report storage is unavailable.");
  const row = { id, session_id: session.id, submission_id: session.submissionId, contact_id: session.contactId, bureau, file_name: fileName, byte_size: bytes.byteLength, uploaded_at: new Date().toISOString(), object_path: objectPath };
  const storage = supabase.storage.from(BUCKET);
  let receiptCommitted = false;
  const heartbeat = setInterval(() => {
    void Promise.resolve(supabase.rpc("renew_credit_report_upload_v1", { p_attempt_id: id }))
      .then(({ data, error }) => {
        if (error || data !== true) console.warn("[credit-report-upload] upload lease renewal was not confirmed");
      })
      .catch(() => console.warn("[credit-report-upload] upload lease renewal was not confirmed"));
  }, 5 * 60_000);
  try {
    const { error: uploadError } = await storage.upload(objectPath, bytes, { contentType: "application/pdf", cacheControl: "0", upsert: false });
    // An uncertain storage failure keeps the attempt pending for reconciliation.
    if (uploadError) throw new Error("The report file could not be stored.");
    if (previous?.object_path) {
      const { error: queueError } = await supabase.rpc("enqueue_credit_report_obsolete_object_v1", {
        p_contact_id: session.contactId,
        p_object_path: previous.object_path,
      });
      if (queueError) {
        console.warn("[credit-report-upload] replaced report cleanup could not be queued");
        throw new Error("The report receipt could not be saved.");
      }
    }
    const { error } = await supabase.from("credit_report_uploads").upsert(row, { onConflict: "session_id,bureau" });
    // An ambiguous metadata failure may have committed. Keep the private object
    // for reconciliation; never delete a file that a committed receipt may name.
    if (error) throw new Error("The report receipt could not be saved.");
    receiptCommitted = true;
    return receipt(row);
  } finally {
    clearInterval(heartbeat);
    if (receiptCommitted) {
      const { data: finished, error: finishError } = await supabase.rpc("finish_credit_report_upload_v1", { p_attempt_id: id });
      if (finishError || finished !== true) throw new Error("The upload could not be finalized.");
    }
  }
}
/** Callers must authorize access to the active CRM contact before using this helper. */
export async function listCreditReportsForContact(contactId: string): Promise<CreditReportReceipt[]> {
  requireDatabase();
  const { data, error } = await createAdminClient().from("credit_report_uploads").select("id,submission_id,bureau,file_name,uploaded_at,byte_size").eq("contact_id", contactId).order("uploaded_at", { ascending: false });
  if (error) throw new Error("Report receipts could not be read.");
  return (data ?? []).map(receipt);
}
/** Contact-scoped, private attachment; no signed/public URLs are created. */
export async function readCreditReportForContact(contactId: string, reportId: string): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  requireDatabase();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("credit_report_uploads").select("file_name,object_path").eq("contact_id", contactId).eq("id", reportId).maybeSingle();
  if (error) throw new Error("Report receipt could not be read.");
  if (!data) return null;
  const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(data.object_path);
  if (downloadError || !blob) throw new Error("Report file could not be read.");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), fileName: data.file_name };
}

const localAttempts = new Map<string, { count: number; resetAt: number }>();
export async function consumeCreditReportRateLimit(request: Request, tokenHash?: string): Promise<boolean> {
  const identity = tokenHash ?? request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const keyHash = hashReportToken(`credit-reports:${identity}`);
  if (isCreditCheckLocalMode()) {
    const now = Date.now();
    for (const [key, value] of localAttempts) if (value.resetAt <= now) localAttempts.delete(key);
    const entry = localAttempts.get(keyHash);
    if (entry) { if (entry.count >= 40) return false; entry.count += 1; }
    else { if (localAttempts.size >= 1000) return false; localAttempts.set(keyHash, { count: 1, resetAt: now + 600_000 }); }
    return true;
  }
  requireDatabase();
  const { data, error } = await createAdminClient().rpc("consume_rate_limit", { p_bucket: "registration", p_key_hash: keyHash, p_window_seconds: 600, p_limit: 40 });
  if (error) throw new Error("Report rate limit unavailable.");
  return data === true;
}
