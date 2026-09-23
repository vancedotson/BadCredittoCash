import "server-only";

import { createAdminClient } from "./supabase/admin";

export const CREDIT_REPORT_RECONCILIATION_MAX_BATCH = 25;

type ReconciliationOptions = { dryRun?: boolean; limit?: number; contactId?: string };
type AttemptClaim = { attempt_id: string; contact_id: string; object_path: string; claim_token: string; previous_state: "pending" | "abandoned" };
type ObsoleteClaim = { contact_id: string; object_path: string; claim_token: string };
type Summary = {
  dryRun: boolean;
  limit: number;
  attempts: number;
  attemptsCompleted: number;
  attemptsAbandoned: number;
  obsoleteObjects: number;
  objectsRemoved: number;
  protectedCurrent: number;
  deferred: number;
  failed: number;
  hasMore: boolean;
};
type FailureCode = "storage_check_failed" | "storage_remove_failed" | "database_check_failed" | "unexpected_error";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkedLimit(value: number | undefined): number {
  const limit = value ?? CREDIT_REPORT_RECONCILIATION_MAX_BATCH;
  if (!Number.isInteger(limit) || limit < 1 || limit > CREDIT_REPORT_RECONCILIATION_MAX_BATCH) {
    throw new Error("Credit-report reconciliation batch limit must be between 1 and 25.");
  }
  return limit;
}

function checkedContactId(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Invalid contact identifier.");
  }
  return value;
}

function isMissingObjectError(error: { statusCode?: string } | null): boolean {
  return error?.statusCode === "400" || error?.statusCode === "404";
}

async function exactObjectExists(storage: ReturnType<ReturnType<typeof createAdminClient>["storage"]["from"]>, path: string): Promise<boolean> {
  const { data, error } = await storage.exists(path);
  if (error && !isMissingObjectError(error)) throw new Error("storage_check_failed");
  return data === true;
}

async function hasCurrentReceipt(client: ReturnType<typeof createAdminClient>, path: string): Promise<boolean> {
  const { data, error } = await client.from("credit_report_uploads").select("id").eq("object_path", path).maybeSingle();
  if (error) throw new Error("database_check_failed");
  return Boolean(data);
}

function failureCode(error: unknown): FailureCode {
  if (error instanceof Error && error.message === "storage_check_failed") return "storage_check_failed";
  if (error instanceof Error && error.message === "storage_remove_failed") return "storage_remove_failed";
  if (error instanceof Error && error.message === "database_check_failed") return "database_check_failed";
  return "unexpected_error";
}

function warnDeferred(kind: "attempt" | "obsolete", reason: FailureCode): void {
  // Never include object paths, contact identifiers, file names, or provider errors.
  console.warn("[credit-report-reconciliation] item deferred", { kind, reason });
}

async function releaseAttempt(client: ReturnType<typeof createAdminClient>, item: AttemptClaim, code: FailureCode): Promise<void> {
  try {
    const { error } = await client.rpc("release_credit_report_attempt_reconciliation_v1", {
      p_attempt_id: item.attempt_id,
      p_claim_token: item.claim_token,
      p_failure_code: code,
    });
    if (error) console.warn("[credit-report-reconciliation] attempt claim release failed", { kind: "attempt", reason: "database_check_failed" });
  } catch {
    console.warn("[credit-report-reconciliation] attempt claim release failed", { kind: "attempt", reason: "database_check_failed" });
  }
}

async function reconcileAttempt(
  client: ReturnType<typeof createAdminClient>,
  item: AttemptClaim,
  summary: Summary,
): Promise<void> {
  const storage = client.storage.from("credit-reports");
  try {
    const exists = await exactObjectExists(storage, item.object_path);
    const referenced = await hasCurrentReceipt(client, item.object_path);
    let removed = false;
    if (exists && !referenced) {
      const result = await storage.remove([item.object_path]);
      if (result.error) throw new Error("storage_remove_failed");
      removed = true;
    }
    const { data, error } = await client.rpc("finish_credit_report_attempt_reconciliation_v1", {
      p_attempt_id: item.attempt_id,
      p_claim_token: item.claim_token,
      p_object_exists: exists,
      p_object_removed: removed,
    });
    if (error || (data !== "completed" && data !== "abandoned")) throw new Error("database_check_failed");
    if (data === "completed") summary.attemptsCompleted += 1;
    else {
      summary.attemptsAbandoned += 1;
      if (exists && removed) summary.objectsRemoved += 1;
    }
  } catch (error) {
    const reason = failureCode(error);
    await releaseAttempt(client, item, reason);
    summary.deferred += 1;
    summary.failed += 1;
    warnDeferred("attempt", reason);
  }
}

async function releaseObsolete(client: ReturnType<typeof createAdminClient>, item: ObsoleteClaim, code: FailureCode): Promise<void> {
  try {
    const { error } = await client.rpc("release_credit_report_obsolete_object_v1", {
      p_object_path: item.object_path,
      p_claim_token: item.claim_token,
      p_failure_code: code,
    });
    if (error) console.warn("[credit-report-reconciliation] obsolete claim release failed", { kind: "obsolete", reason: "database_check_failed" });
  } catch {
    console.warn("[credit-report-reconciliation] obsolete claim release failed", { kind: "obsolete", reason: "database_check_failed" });
  }
}

async function reconcileObsoleteObject(
  client: ReturnType<typeof createAdminClient>,
  item: ObsoleteClaim,
  summary: Summary,
): Promise<void> {
  const storage = client.storage.from("credit-reports");
  let exists: boolean;
  try {
    exists = await exactObjectExists(storage, item.object_path);
  } catch (error) {
    const reason = failureCode(error);
    await releaseObsolete(client, item, reason);
    summary.deferred += 1;
    summary.failed += 1;
    warnDeferred("obsolete", reason);
    return;
  }

  let referenced: boolean;
  try {
    referenced = await hasCurrentReceipt(client, item.object_path);
  } catch (error) {
    const reason = failureCode(error);
    await releaseObsolete(client, item, reason);
    summary.deferred += 1;
    summary.failed += 1;
    warnDeferred("obsolete", reason);
    return;
  }

  let removeFailed = false;
  let removedObject = false;
  if (exists && !referenced) {
    try {
      const result = await storage.remove([item.object_path]);
      removeFailed = Boolean(result.error);
      removedObject = !removeFailed;
    } catch {
      removeFailed = true;
    }
  }

  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await client.rpc("finish_credit_report_obsolete_object_v1", {
      p_object_path: item.object_path,
      p_claim_token: item.claim_token,
      p_failure_code: removeFailed ? "storage_remove_failed" : null,
    }));
  } catch {
    error = true;
  }
  if (error || !["removed", "protected_current", "deferred", "missing"].includes(String(data))) {
    const reason = removeFailed ? "storage_remove_failed" : "database_check_failed";
    await releaseObsolete(client, item, reason);
    summary.deferred += 1;
    summary.failed += 1;
    warnDeferred("obsolete", reason);
    return;
  }
  if (data === "protected_current") summary.protectedCurrent += 1;
  if (data === "deferred") {
    summary.deferred += 1;
    summary.failed += 1;
    warnDeferred("obsolete", "storage_remove_failed");
  }
  if (data === "removed" && removedObject) summary.objectsRemoved += 1;
}

/**
 * Reconcile only indexed, registered attempt paths and exact queued obsolete paths.
 * A 24-hour quiet period plus expiring upload/reconciliation leases protects live
 * uploads; abandoned attempts remain as tombstones for late-completion sweeps.
 */
export async function reconcileCreditReportArtifacts(options: ReconciliationOptions = {}): Promise<Summary> {
  const limit = checkedLimit(options.limit);
  const contactId = checkedContactId(options.contactId);
  const client = createAdminClient();
  const { data: countsData, error: countsError } = await client.rpc("credit_report_reconciliation_counts_v1", {
    p_limit: limit,
    p_contact_id: contactId,
  });
  if (countsError || !isObject(countsData)) throw new Error("Credit-report reconciliation is unavailable.");
  const counts = countsData as { attempts?: unknown; obsoleteObjects?: unknown; hasMore?: unknown };
  const summary: Summary = {
    dryRun: options.dryRun === true,
    limit,
    attempts: Number.isInteger(counts.attempts) ? Number(counts.attempts) : 0,
    attemptsCompleted: 0,
    attemptsAbandoned: 0,
    obsoleteObjects: Number.isInteger(counts.obsoleteObjects) ? Number(counts.obsoleteObjects) : 0,
    objectsRemoved: 0,
    protectedCurrent: 0,
    deferred: 0,
    failed: 0,
    hasMore: counts.hasMore === true,
  };
  if (summary.dryRun) return summary;

  const { data: attemptsData, error: attemptsError } = await client.rpc("claim_credit_report_attempts_v1", {
    p_limit: limit,
    p_contact_id: contactId,
  });
  if (attemptsError || !Array.isArray(attemptsData)) throw new Error("Credit-report reconciliation is unavailable.");
  const attempts = attemptsData as AttemptClaim[];
  summary.attempts = attempts.length;
  for (const item of attempts) await reconcileAttempt(client, item, summary);

  const remaining = limit - attempts.length;
  if (remaining > 0) {
    const { data: obsoleteData, error: obsoleteError } = await client.rpc("claim_credit_report_obsolete_objects_v1", {
      p_limit: remaining,
      p_contact_id: contactId,
    });
    if (obsoleteError || !Array.isArray(obsoleteData)) throw new Error("Credit-report reconciliation is unavailable.");
    const obsolete = obsoleteData as ObsoleteClaim[];
    summary.obsoleteObjects = obsolete.length;
    for (const item of obsolete) await reconcileObsoleteObject(client, item, summary);
  } else {
    summary.obsoleteObjects = 0;
  }
  return summary;
}
