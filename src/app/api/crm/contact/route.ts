import { NextResponse } from "next/server";
import { createLead, getSettings } from "@/lib/store";
import { STAGES_IN_ORDER, type Stage } from "@/lib/stages";

/**
 * POST /api/crm/contact — manually create a contact (walk-ins, phone leads,
 * referrals). Used by the pipeline "Add contact" form.
 */
export async function POST(request: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    source?: string;
    stage?: string;
    owner?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid name and email are required." }, { status: 400 });
  }
  const stage = STAGES_IN_ORDER.includes(body.stage as Stage) ? (body.stage as Stage) : "new";
  const owner = body.owner?.trim() || (await getSettings()).defaultOwner;

  const lead = await createLead({
    name,
    email,
    phone: body.phone?.trim() || undefined,
    source: body.source?.trim() || "manual",
    stage,
    owner,
    stageChangedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, lead });
}
