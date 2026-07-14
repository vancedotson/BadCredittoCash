import { NextResponse } from "next/server";
import { upsertLeadByEmail } from "@/lib/store";
import { STAGES_IN_ORDER, type Stage } from "@/lib/stages";

/**
 * POST /api/crm/import — bulk-import contacts (the inverse of CSV export).
 * body: { contacts: Array<{ name?, email, phone?, source?, stage?, owner? }> }
 * Upserts by email; returns how many were imported vs skipped.
 */
export async function POST(request: Request) {
  let body: { contacts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const rows = Array.isArray(body.contacts) ? body.contacts : [];
  let imported = 0;
  let skipped = 0;
  for (const r of rows as Array<Record<string, unknown>>) {
    const email = typeof r.email === "string" ? r.email.trim() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; continue; }
    const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : email.split("@")[0];
    await upsertLeadByEmail(email, {
      name,
      phone: typeof r.phone === "string" ? r.phone.trim() || undefined : undefined,
      source: typeof r.source === "string" && r.source.trim() ? r.source.trim() : "import",
      stage: STAGES_IN_ORDER.includes(r.stage as Stage) ? (r.stage as Stage) : undefined,
      owner: typeof r.owner === "string" ? r.owner.trim() || undefined : undefined,
    });
    imported++;
  }
  return NextResponse.json({ ok: true, imported, skipped });
}
