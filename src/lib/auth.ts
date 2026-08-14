import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function getCrmUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;
  const { data: membership, error: membershipError } = await supabase
    .from("crm_users")
    .select("role, display_name")
    .eq("user_id", data.claims.sub)
    .maybeSingle();

  if (membershipError || !membership) return null;
  return {
    ...data.claims,
    crmRole: membership.role as "admin" | "staff" | "readonly",
    displayName: membership.display_name as string | null,
  };
}

export async function requireCrmUser() {
  const user = await getCrmUser();
  if (!user) redirect("/login");
  return user;
}

type CrmApiAccess = "read" | "write" | "personal-write" | "admin" | "admin-write";

export async function requireCrmApiUser(
  request?: Request,
  access: CrmApiAccess = "read",
) {
  const user = await getCrmUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const needsWrite = access === "write" || access === "admin-write";
  const mutates = needsWrite || access === "personal-write";
  const needsAdmin = access === "admin" || access === "admin-write";
  if (needsAdmin && user.crmRole !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
    };
  }
  if (needsWrite && user.crmRole === "readonly") {
    return {
      user: null,
      response: NextResponse.json({ error: "This account has read-only access." }, { status: 403 }),
    };
  }
  if (mutates) {
    const origin = request?.headers.get("origin");
    const requestOrigin = request ? new URL(request.url).origin : null;
    if (!origin || origin !== requestOrigin) {
      return {
        user: null,
        response: NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 }),
      };
    }
  }

  return { user, response: null };
}
