import { NextResponse } from "next/server";
import { listExistingContactEmails, upsertLeadByEmail, updateLead } from "@/lib/store";
import { STAGES_IN_ORDER, STAGE_LABELS, type Stage } from "@/lib/stages";
import { requireCrmApiUser } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/audit";

/**
 * POST /api/crm/import — bulk-import contacts (the inverse of CSV export).
 * Preview first, then commit the same rows with explicit confirmation.
 */
export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "admin-write");
  if (auth.response) return auth.response;
  let body: { contacts?: unknown; mode?: unknown; confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const rows = Array.isArray(body.contacts) ? body.contacts : [];
  if (!rows.length) return NextResponse.json({ error: "No contact rows were supplied." }, { status: 400 });
  if (rows.length > 500) return NextResponse.json({ error: "Imports are limited to 500 rows per file." }, { status: 400 });

  const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const normalizeStage = (value: unknown): Stage | undefined => {
    const raw = clean(value, 60).toLowerCase();
    if (!raw) return undefined;
    return STAGES_IN_ORDER.find((stage) => stage === raw || STAGE_LABELS[stage].toLowerCase() === raw);
  };
  const seen = new Set<string>();
  const valid: Array<{ row: number; name: string; email: string; phone?: string; source: string; stage?: Stage; owner?: string }> = [];
  const issues: Array<{ row: number; email?: string; reason: string }> = [];
  for (const [index, raw] of (rows as Array<Record<string, unknown>>).entries()) {
    const row = index + 2;
    const email = clean(raw.email, 320).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ row, email: email || undefined, reason: "Missing or invalid email address." });
      continue;
    }
    if (seen.has(email)) {
      issues.push({ row, email, reason: "Duplicate email inside this file." });
      continue;
    }
    seen.add(email);
    const stage = normalizeStage(raw.stage);
    if (clean(raw.stage, 60) && !stage) {
      issues.push({ row, email, reason: "Unknown pipeline stage." });
      continue;
    }
    valid.push({
      row,
      email,
      name: clean(raw.name, 120) || email.split("@")[0],
      phone: clean(raw.phone, 40) || undefined,
      source: clean(raw.source, 100) || "import",
      stage,
      owner: clean(raw.owner, 120) || undefined,
    });
  }
  const existing = await listExistingContactEmails(valid.map((row) => row.email));
  const summary = {
    total: rows.length,
    valid: valid.length,
    invalid: issues.length,
    newContacts: valid.filter((row) => !existing.has(row.email)).length,
    updates: valid.filter((row) => existing.has(row.email)).length,
  };

  if (body.mode !== "commit") {
    return NextResponse.json({ ok: true, preview: true, summary, issues: issues.slice(0, 50) });
  }
  if (body.confirm !== "IMPORT") {
    return NextResponse.json({ error: "Explicit import confirmation is required." }, { status: 400 });
  }
  let imported = 0;
  for (const row of valid) {
    const lead = await upsertLeadByEmail(row.email, {
      name: row.name,
      phone: row.phone,
      source: row.source,
      stage: row.stage,
      owner: row.owner,
    });
    await updateLead(lead.id, {
      stage: row.stage,
      owner: row.owner,
    });
    imported++;
  }
  const skipped = issues.length;
  await recordAdminAudit({
    actorId: String(auth.user.sub),
    action: "contacts.import",
    entityType: "contacts",
    afterState: { imported, skipped, newContacts: summary.newContacts, updates: summary.updates },
  });
  return NextResponse.json({ ok: true, imported, skipped, summary });
}
