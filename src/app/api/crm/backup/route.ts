import { NextResponse } from "next/server";

import { recordAdminAudit } from "@/lib/audit";
import { requireCrmApiUser } from "@/lib/auth";
import { createCrmBackup, validateCrmBackup } from "@/lib/backup";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireCrmApiUser(undefined, "admin");
  if (auth.response) return auth.response;
  const backup = await createCrmBackup();
  await recordAdminAudit({ actorId: String(auth.user.sub), action: "crm.backup", entityType: "crm", afterState: { exportedAt: backup.exportedAt, contacts: backup.tables.contacts.length } });
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="vance-crm-backup-${backup.exportedAt.slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "admin-write");
  if (auth.response) return auth.response;
  let body: { backup?: unknown; confirmation?: unknown; preview?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The backup file is not valid JSON." }, { status: 400 }); }
  const validation = validateCrmBackup(body.backup);
  if (!validation.backup) return NextResponse.json({ error: validation.error }, { status: 400 });
  if (body.preview === true) return NextResponse.json({ ok: true, exportedAt: validation.backup.exportedAt, counts: validation.counts });
  if (body.confirmation !== "RESTORE VANCE CRM") return NextResponse.json({ error: "Type RESTORE VANCE CRM to confirm replacement of current CRM data." }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("restore_crm_backup_v1", { p_backup: validation.backup });
  if (error) return NextResponse.json({ error: `Restore failed safely: ${error.message}` }, { status: 409 });
  await recordAdminAudit({ actorId: String(auth.user.sub), action: "crm.restore", entityType: "crm", afterState: { exportedAt: validation.backup.exportedAt, counts: validation.counts } });
  return NextResponse.json({ ok: true, result: data });
}

