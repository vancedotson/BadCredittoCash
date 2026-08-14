import { NextResponse } from "next/server";

import { requireCrmApiUser } from "@/lib/auth";
import {
  GOOGLE_CALENDAR_REDIRECT_URI,
  GOOGLE_CALENDAR_SCOPES,
} from "@/lib/google-calendar";
import { signGoogleOAuthState } from "@/lib/secret-crypto";

export async function GET() {
  const auth = await requireCrmApiUser(undefined, "admin");
  if (auth.response) return auth.response;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return new NextResponse("Google OAuth is not configured.", { status: 503 });
  const state = await signGoogleOAuthState(String(auth.user.sub));
  const target = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  target.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_CALENDAR_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    state,
  }).toString();
  return NextResponse.redirect(target);
}
