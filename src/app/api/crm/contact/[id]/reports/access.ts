import { NextResponse } from "next/server";
import { requireCrmApiUser } from "@/lib/auth";
import { isCrmDemoMode } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { hasContactReportPurgeStarted } from "@/lib/credit-report-privacy";

export const reportResponseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export function reportError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: reportResponseHeaders });
}

export function isReportId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Check the real session and RLS-visible active contact before private storage. */
export async function requireReportContact(request: Request, contactId: string) {
  if (isCrmDemoMode()) {
    return reportError("Credit reports require a signed-in live CRM account.", 403);
  }
  const auth = await requireCrmApiUser(request, "read");
  if (auth.response) {
    for (const [name, value] of Object.entries(reportResponseHeaders)) auth.response.headers.set(name, value);
    return auth.response;
  }
  if (!isReportId(contactId)) return reportError("Contact not found.", 404);

  const supabase = await createClient();
  // Trashing a contact removes it from contacts. Do not use the hydrated cache
  // or a service-role lookup to authorize access to its sensitive attachments.
  const { data, error } = await supabase.from("contacts").select("id").eq("id", contactId).maybeSingle();
  if (error) throw new Error("Could not verify contact access.");
  if (data?.id !== contactId) return reportError("Contact not found.", 404);
  return await hasContactReportPurgeStarted(contactId) ? reportError("Reports are unavailable while this contact is being deleted.", 409) : null;
}

export function reportDownloadName(fileName: string) {
  const base = (fileName.split(/[\\/]/).pop() ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9 ._-]/g, "_")
    .replace(/^[. ]+|[. ]+$/g, "")
    .slice(0, 120);
  return `${base || "credit-report"}.pdf`;
}
