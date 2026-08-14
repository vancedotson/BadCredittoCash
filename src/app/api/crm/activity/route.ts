import { NextResponse } from "next/server";
import { listActivity, getActivitySummary, hydrateStore } from "@/lib/store";
import { requireCrmApiUser } from "@/lib/auth";

/**
 * GET /api/crm/activity — filterable, paginated activity feed (+ summary).
 * query: search, category, important=1, owner, from, to, limit, offset
 */
export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if (auth.response) return auth.response;
  await hydrateStore();
  const sp = new URL(request.url).searchParams;
  const get = (k: string) => sp.get(k) || undefined;
  const num = (k: string, d: number) => Number(sp.get(k)) || d;

  const [page, summary] = await Promise.all([
    listActivity({
      search: get("search"),
      category: get("category"),
      important: sp.get("important") === "1",
      owner: get("owner"),
      from: get("from"),
      to: get("to"),
      limit: num("limit", 40),
      offset: num("offset", 0),
    }),
    getActivitySummary(),
  ]);

  return NextResponse.json({ ...page, summary });
}
