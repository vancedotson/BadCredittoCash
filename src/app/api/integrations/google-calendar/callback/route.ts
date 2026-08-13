import { NextResponse } from "next/server";

import { getCrmUser } from "@/lib/auth";
import {
  exchangeGoogleAuthorizationCode,
  saveGoogleCalendarConnection,
} from "@/lib/google-calendar";
import { verifyGoogleOAuthState } from "@/lib/secret-crypto";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return NextResponse.redirect(new URL("/crm/settings?calendar=denied#calendar", url));
  if (!code || !state) return new NextResponse("Invalid Google OAuth callback.", { status: 400 });

  const [user, stateUserId] = await Promise.all([
    getCrmUser(),
    verifyGoogleOAuthState(state),
  ]);
  if (!user || user.crmRole !== "admin" || stateUserId !== String(user.sub)) {
    return new NextResponse("Google Calendar authorization expired or was rejected.", { status: 403 });
  }

  try {
    const refreshToken = await exchangeGoogleAuthorizationCode(code);
    await saveGoogleCalendarConnection(refreshToken);
    return NextResponse.redirect(new URL("/crm/settings?calendar=connected#calendar", url));
  } catch (error) {
    console.error("[google-calendar] OAuth callback failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.redirect(new URL("/crm/settings?calendar=error#calendar", url));
  }
}
