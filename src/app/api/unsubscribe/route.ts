import { NextResponse } from "next/server";

import { verifyUnsubscribeToken } from "@/lib/email-token";
import { createAdminClient } from "@/lib/supabase/admin";

function destination(request: Request, state: "done" | "error"): URL {
  return new URL(`/unsubscribe?${state}=1`, request.url);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token");
  if (!token) {
    try {
      const form = await request.formData();
      const value = form.get("token");
      token = typeof value === "string" ? value : null;
    } catch {
      token = null;
    }
  }

  const messageId = token ? verifyUnsubscribeToken(token) : null;
  if (!messageId) return NextResponse.redirect(destination(request, "error"), 303);

  const { data, error } = await createAdminClient().rpc("unsubscribe_contact_from_message", {
    p_message_id: messageId,
  });
  if (error || data !== true) {
    console.error("[unsubscribe] failed", { code: error?.code ?? "not_found" });
    return NextResponse.redirect(destination(request, "error"), 303);
  }

  return NextResponse.redirect(destination(request, "done"), 303);
}

