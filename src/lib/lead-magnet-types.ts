import type { CreditReportReceipt } from "./credit-reports";
import type { Stage } from "./stages";

export type LeadMagnetStatus = "all" | "waiting" | "partial" | "complete";
export type LeadMagnetQuery = { search?: string; status?: LeadMagnetStatus; page?: number; pageSize?: number };
export type LeadMagnetRow = {
  contactId: string;
  name: string;
  email: string;
  phone?: string;
  owner?: string;
  stage: Stage;
  companies: string[];
  firstSubmittedAt: string;
  lastSubmittedAt: string;
  submissionCount: number;
  reports: CreditReportReceipt[];
};
export type LeadMagnetSummary = { totalSignups: number; newLast30Days: number; waiting: number; partial: number; complete: number };
export type LeadMagnetWorkspace = {
  rows: LeadMagnetRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: LeadMagnetSummary;
  demo: boolean;
};

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  if (typeof value === "string" && !/^\d+$/.test(value)) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 1 ? Math.min(maximum, Math.floor(numeric)) : fallback;
}

/** Shared by the server reader and URL controls; never interpolated into SQL. */
export function normalizeLeadMagnetQuery(query: { search?: unknown; status?: unknown; page?: unknown; pageSize?: unknown } = {}): Required<LeadMagnetQuery> {
  return {
    search: typeof query.search === "string" ? query.search.trim().slice(0, 200) : "",
    status: query.status === "waiting" || query.status === "partial" || query.status === "complete" ? query.status : "all",
    page: positiveInteger(query.page, 1, 1_000_000_000),
    pageSize: positiveInteger(query.pageSize, 25, 100),
  };
}
