import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
};

export async function GET() {
  try {
    const { error } = await createAdminClient()
      .from("contacts")
      .select("id", { count: "exact", head: true });

    if (error) throw new Error(error.message);

    return Response.json({ ok: true }, { status: 200, headers });
  } catch (error) {
    console.error("[public-health] check failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
