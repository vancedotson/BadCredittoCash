import { NextResponse } from "next/server";

import { requireCrmApiUser } from "@/lib/auth";
import { readLimitedJson } from "@/lib/public-api";
import { CREDIT_REPORT_RECONCILIATION_MAX_BATCH, reconcileCreditReportArtifacts } from "@/lib/credit-report-reconciliation";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "admin-write");
  if (auth.response) {
    for (const [name, value] of Object.entries(NO_STORE)) auth.response.headers.set(name, value);
    return auth.response;
  }
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Invalid reconciliation request." }, { status: 415, headers: NO_STORE });
  }
  const parsed = await readLimitedJson<unknown>(request, 1024);
  if (!parsed.ok || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return NextResponse.json({ error: "Invalid reconciliation request." }, { status: 400, headers: NO_STORE });
  }
  const body = parsed.value as { dryRun?: unknown; limit?: unknown };
  if (typeof body.dryRun !== "boolean"
    || !Number.isInteger(body.limit)
    || Number(body.limit) < 1
    || Number(body.limit) > CREDIT_REPORT_RECONCILIATION_MAX_BATCH) {
    return NextResponse.json({ error: "Provide dryRun and a batch limit from 1 to 25." }, { status: 400, headers: NO_STORE });
  }
  try {
    const result = await reconcileCreditReportArtifacts({ dryRun: body.dryRun, limit: Number(body.limit) });
    return NextResponse.json({ ok: true, result }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Credit-report reconciliation is temporarily unavailable." }, { status: 503, headers: NO_STORE });
  }
}
