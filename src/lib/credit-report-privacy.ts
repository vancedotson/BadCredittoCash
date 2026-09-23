import "server-only";

import { createAdminClient } from "./supabase/admin";
import { reconcileCreditReportArtifacts } from "./credit-report-reconciliation";

const CONTACT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "credit-reports";

export async function hasContactReportPurgeStarted(contactId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from("credit_report_purge_blocks").select("contact_id").eq("contact_id", contactId).maybeSingle();
  if (error) throw new Error("Could not verify report availability.");
  return Boolean(data);
}

/** Revoke first; never remove the contact's metadata until all bytes are gone. */
export async function removeContactCreditReportFiles(contactId: string): Promise<boolean> {
  if (!CONTACT_ID.test(contactId)) throw new Error("Invalid contact identifier.");
  const supabase = createAdminClient();
  const preparePurge = async () => supabase.rpc("begin_credit_report_purge_v1", { p_contact_id: contactId });
  let { data: preparation, error: prepareError } = await preparePurge();
  if (prepareError || !preparation || typeof preparation.found !== "boolean" || typeof preparation.pending !== "number") {
    throw new Error("Could not prepare report deletion. Nothing has been permanently deleted.");
  }
  if (!preparation.found) return false;
  if (preparation.pending > 0) {
    // Purge has already blocked new sessions. Reconcile only stale registered
    // attempts; recent/in-flight work remains a blocker and fails closed.
    await reconcileCreditReportArtifacts({ limit: 25, contactId });
    ({ data: preparation, error: prepareError } = await preparePurge());
    if (prepareError || !preparation || typeof preparation.found !== "boolean" || typeof preparation.pending !== "number") {
      throw new Error("Could not prepare report deletion. Nothing has been permanently deleted.");
    }
    if (!preparation.found) return false;
    if (preparation.pending > 0) {
      throw new Error("A recent or uncertain report upload is still finishing. Please retry deletion later.");
    }
  }

  const storage = supabase.storage.from(BUCKET);
  const files: string[] = [];
  const folders = [contactId];
  // Enumerate the entire exact contact prefix, including replaced files or
  // uploads whose metadata write failed. Never delete Storage database rows.
  for (let folderIndex = 0; folderIndex < folders.length; folderIndex += 1) {
    if (folders.length + files.length > 10_000) throw new Error("Report deletion requires an operator review.");
    const prefix = folders[folderIndex];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !data) throw new Error("Could not list report files. Contact deletion was stopped.");
      for (const entry of data) {
        if (!entry.name || entry.name === "." || entry.name === ".." || /[\\/]/.test(entry.name)) {
          throw new Error("An unexpected report path stopped contact deletion.");
        }
        const path = `${prefix}/${entry.name}`;
        if (entry.id) files.push(path);
        else folders.push(path);
      }
      if (data.length < 1000) break;
      if (offset >= 10_000) throw new Error("Report deletion requires an operator review.");
    }
  }
  for (let index = 0; index < files.length; index += 100) {
    const { error } = await storage.remove(files.slice(index, index + 100));
    if (error) throw new Error("Some report files could not be deleted. Contact deletion was stopped; please retry.");
  }
  // The final purge RPC independently verifies Storage is empty and no upload
  // is pending, then removes receipts/sessions and the existing CRM records.
  return true;
}
