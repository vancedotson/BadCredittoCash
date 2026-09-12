import "server-only";

import { isCrmDemoMode } from "./demo";
import { createClient } from "./supabase/server";
import { isCreditReportBureau } from "./credit-report-validation";
import { isStage } from "./stages";
import { normalizeLeadMagnetQuery, type LeadMagnetQuery, type LeadMagnetRow, type LeadMagnetSummary, type LeadMagnetWorkspace } from "./lead-magnet-types";
import type { CreditReportReceipt } from "./credit-reports";

export type { LeadMagnetQuery, LeadMagnetRow, LeadMagnetSummary, LeadMagnetWorkspace } from "./lead-magnet-types";

const DAY = 86_400_000;
const READ_ERROR = "Lead magnet signups could not be loaded.";
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(READ_ERROR);
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new Error(READ_ERROR);
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(READ_ERROR);
  return value;
}
function timestamp(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error(READ_ERROR);
  return result;
}
function report(value: unknown): CreditReportReceipt {
  const row = record(value);
  if (typeof row.bureau !== "string" || !isCreditReportBureau(row.bureau)) throw new Error(READ_ERROR);
  // Allowlist the DTO: private object paths and upload tokens cannot escape here.
  return { id: text(row.id), submissionId: text(row.submissionId), bureau: row.bureau, fileName: text(row.fileName), uploadedAt: timestamp(row.uploadedAt), byteSize: count(row.byteSize) };
}
function parseRow(value: unknown): LeadMagnetRow {
  const row = record(value);
  const stage = row.stage === "call_booked" ? "booked" : isStage(row.stage) ? row.stage : "new";
  if (!Array.isArray(row.companies) || !Array.isArray(row.reports)) throw new Error(READ_ERROR);
  const reports = row.reports.map(report);
  if (reports.length > 3 || new Set(reports.map((receipt) => receipt.bureau)).size !== reports.length) throw new Error(READ_ERROR);
  return {
    contactId: text(row.contactId), name: text(row.name), email: text(row.email),
    ...(row.phone == null ? {} : { phone: text(row.phone) }),
    ...(row.owner == null ? {} : { owner: text(row.owner) }),
    stage, companies: row.companies.map(text), firstSubmittedAt: timestamp(row.firstSubmittedAt),
    lastSubmittedAt: timestamp(row.lastSubmittedAt), submissionCount: count(row.submissionCount), reports,
  };
}
function parseWorkspace(value: unknown): LeadMagnetWorkspace {
  const data = record(value);
  const summary = record(data.summary);
  if (!Array.isArray(data.rows)) throw new Error(READ_ERROR);
  const page = count(data.page);
  const pageSize = count(data.pageSize);
  if (page < 1 || pageSize < 1 || pageSize > 100 || data.rows.length > pageSize) throw new Error(READ_ERROR);
  return {
    rows: data.rows.map(parseRow), total: count(data.total), page, pageSize, demo: false,
    summary: { totalSignups: count(summary.totalSignups), newLast30Days: count(summary.newLast30Days), waiting: count(summary.waiting), partial: count(summary.partial), complete: count(summary.complete) },
  };
}

async function demoWorkspace(query: Required<LeadMagnetQuery>): Promise<LeadMagnetWorkspace> {
  // These are fictional display receipts, never local intake files or real PDFs.
  // Resolve known sample contacts so their existing CRM profile links stay valid.
  const { listContacts } = await import("./store");
  const contacts = (await listContacts({ pageSize: 100 })).rows;
  const now = Date.now();
  const samples = [
    { email: "evan@example.com", first: 1, last: 1, submissions: 1, bureaus: [] },
    { email: "grace@example.com", first: 6, last: 2, submissions: 2, bureaus: ["transunion", "equifax"] },
    { email: "ana@example.com", first: 45, last: 3, submissions: 2, bureaus: ["transunion", "equifax", "experian"] },
  ] as const;
  const rows: LeadMagnetRow[] = samples.flatMap((sample, index) => {
    const contact = contacts.find((item) => item.email === sample.email);
    if (!contact) return [];
    const submittedAt = new Date(now - sample.last * DAY).toISOString();
    return [{
      contactId: contact.id, name: contact.name, email: contact.email, phone: contact.phone, owner: contact.owner, stage: contact.stage,
      companies: index === 0 ? ["I’m not sure yet—I need to check my reports"] : ["Midland Credit Management", "Portfolio Recovery Associates"],
      firstSubmittedAt: new Date(now - sample.first * DAY).toISOString(), lastSubmittedAt: submittedAt, submissionCount: sample.submissions,
      reports: sample.bureaus.map((bureau, bureauIndex) => ({ id: `91300000-0000-4000-8000-${String(index * 10 + bureauIndex + 1).padStart(12, "0")}`, submissionId: `91300000-0000-4000-8001-${String(index + 1).padStart(12, "0")}`, bureau, fileName: `${bureau}-sample.pdf`, uploadedAt: submittedAt, byteSize: 245760 })),
    }];
  });
  const summary: LeadMagnetSummary = {
    totalSignups: rows.length, newLast30Days: rows.filter((row) => Date.parse(row.firstSubmittedAt) >= now - 30 * DAY).length,
    waiting: rows.filter((row) => row.reports.length === 0).length, partial: rows.filter((row) => row.reports.length > 0 && row.reports.length < 3).length,
    complete: rows.filter((row) => row.reports.length === 3).length,
  };
  const needle = query.search.toLocaleLowerCase();
  const filtered = rows.filter((row) => (!needle || row.name.toLocaleLowerCase().includes(needle) || row.email.toLocaleLowerCase().includes(needle))
    && (query.status === "all" || (query.status === "waiting" ? row.reports.length === 0 : query.status === "complete" ? row.reports.length === 3 : row.reports.length > 0 && row.reports.length < 3)));
  const page = Math.min(query.page, Math.max(1, Math.ceil(filtered.length / query.pageSize)));
  return { rows: filtered.slice((page - 1) * query.pageSize, page * query.pageSize), total: filtered.length, page, pageSize: query.pageSize, summary, demo: true };
}

/** Authenticated CRM RPC: the database checks membership and returns metadata only. */
export async function getLeadMagnetWorkspace(query: LeadMagnetQuery = {}): Promise<LeadMagnetWorkspace> {
  const normalized = normalizeLeadMagnetQuery(query);
  if (isCrmDemoMode()) return demoWorkspace(normalized);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_lead_magnet_workspace_v1", { p_search: normalized.search, p_status: normalized.status, p_page: normalized.page, p_page_size: normalized.pageSize });
  if (error) throw new Error(READ_ERROR);
  return parseWorkspace(data);
}
