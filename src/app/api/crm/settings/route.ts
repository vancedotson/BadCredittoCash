import { NextResponse } from "next/server";
import {
  addOwner, removeOwner, renameOwner, setDefaultOwner,
  createTag, renameTag, mergeTag, deleteTag,
  updateProfile, updatePrefs, resetStore, exportAllData,
  type CrmProfile, type CrmPrefs,
} from "@/lib/store";

/** GET /api/crm/settings — full JSON export of the store (backup). */
export async function GET() {
  const data = await exportAllData();
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vance-crm-export.json"`,
    },
  });
}

/** POST /api/crm/settings — owners, tags, profile, preferences, and data actions. */
export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const action = typeof b.action === "string" ? b.action : "";
  const value = typeof b.value === "string" ? b.value.trim() : "";
  const to = typeof b.to === "string" ? b.to.trim() : "";

  switch (action) {
    case "add-owner":
      if (!value) break;
      return NextResponse.json({ ok: true, owners: await addOwner(value) });
    case "rename-owner":
      if (!value || !to) break;
      return NextResponse.json({ ok: true, owners: await renameOwner(value, to) });
    case "remove-owner": {
      if (!value) break;
      const reassignTo = typeof b.reassignTo === "string" ? b.reassignTo : undefined;
      return NextResponse.json({ ok: true, owners: await removeOwner(value, reassignTo) });
    }
    case "set-default-owner":
      await setDefaultOwner(value);
      return NextResponse.json({ ok: true });
    case "create-tag":
      if (!value) break;
      await createTag(value);
      return NextResponse.json({ ok: true });
    case "rename-tag":
      if (!value || !to) break;
      await renameTag(value, to);
      return NextResponse.json({ ok: true });
    case "merge-tag":
      if (!value || !to) break;
      await mergeTag(value, to);
      return NextResponse.json({ ok: true });
    case "delete-tag":
      if (!value) break;
      await deleteTag(value);
      return NextResponse.json({ ok: true });
    case "update-profile":
      if (typeof b.profile === "object" && b.profile) return NextResponse.json({ ok: true, profile: await updateProfile(b.profile as Partial<CrmProfile>) });
      break;
    case "update-prefs":
      if (typeof b.prefs === "object" && b.prefs) return NextResponse.json({ ok: true, prefs: await updatePrefs(b.prefs as Partial<CrmPrefs>) });
      break;
    case "reset-data":
      await resetStore();
      return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown or incomplete action." }, { status: 400 });
}
