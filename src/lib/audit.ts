import "server-only";

import { createClient } from "./supabase/server";

export async function recordAdminAudit(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("audit_log").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
  });
  if (error) throw new Error(`Could not record audit event: ${error.message}`);
}

export type AdminAuditEvent = {
  id: number;
  action: string;
  entityType: string;
  entityId?: string;
  actorName: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  createdAt: string;
};

export async function listAdminAuditEvents(limit = 50): Promise<AdminAuditEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, before_state, after_state, created_at, actor:crm_users!audit_log_actor_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new Error(`Could not read audit history: ${error.message}`);
  return (data ?? []).map((row) => {
    const actor = row.actor as unknown as { display_name: string | null } | Array<{ display_name: string | null }> | null;
    return {
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      actorName: (Array.isArray(actor) ? actor[0]?.display_name : actor?.display_name) ?? "Unknown user",
      beforeState: row.before_state ?? undefined,
      afterState: row.after_state ?? undefined,
      createdAt: row.created_at,
    };
  });
}
