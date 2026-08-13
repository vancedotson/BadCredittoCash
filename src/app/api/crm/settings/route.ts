import { NextResponse } from "next/server";
import {
  addOwner, removeOwner, renameOwner, setDefaultOwner,
  createTag, renameTag, mergeTag, deleteTag,
  updateProfile, updatePrefs,
  type CrmProfile, type CrmPrefs,
} from "@/lib/store";
import { requireCrmApiUser } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/audit";

/** POST /api/crm/settings — owners, tags, profile, preferences, and data actions. */
export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "admin-write");
  if (auth.response) return auth.response;
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const action = typeof b.action === "string" ? b.action : "";
  const value = typeof b.value === "string" ? b.value.trim() : "";
  const to = typeof b.to === "string" ? b.to.trim() : "";
  const audited = async (payload: Record<string, unknown>, entityType = "settings") => {
    await recordAdminAudit({
      actorId: String(auth.user.sub),
      action: `settings.${action.replaceAll("-", "_")}`,
      entityType,
      entityId: value || undefined,
      afterState: { value: value || undefined, to: to || undefined },
    });
    return NextResponse.json(payload);
  };

  switch (action) {
    case "add-owner":
      if (!value) break;
      return audited({ ok: true, owners: await addOwner(value) }, "owner");
    case "rename-owner":
      if (!value || !to) break;
      return audited({ ok: true, owners: await renameOwner(value, to) }, "owner");
    case "remove-owner": {
      if (!value) break;
      const reassignTo = typeof b.reassignTo === "string" ? b.reassignTo : undefined;
      return audited({ ok: true, owners: await removeOwner(value, reassignTo) }, "owner");
    }
    case "set-default-owner":
      await setDefaultOwner(value);
      return audited({ ok: true }, "owner");
    case "create-tag":
      if (!value) break;
      await createTag(value);
      return audited({ ok: true }, "tag");
    case "rename-tag":
      if (!value || !to) break;
      await renameTag(value, to);
      return audited({ ok: true }, "tag");
    case "merge-tag":
      if (!value || !to) break;
      await mergeTag(value, to);
      return audited({ ok: true }, "tag");
    case "delete-tag":
      if (!value) break;
      await deleteTag(value);
      return audited({ ok: true }, "tag");
    case "update-profile":
      if (typeof b.profile === "object" && b.profile) return audited({ ok: true, profile: await updateProfile(b.profile as Partial<CrmProfile>) });
      break;
    case "update-prefs":
      if (typeof b.prefs === "object" && b.prefs) return audited({ ok: true, prefs: await updatePrefs(b.prefs as Partial<CrmPrefs>) });
      break;
  }
  return NextResponse.json({ error: "Unknown or incomplete action." }, { status: 400 });
}
