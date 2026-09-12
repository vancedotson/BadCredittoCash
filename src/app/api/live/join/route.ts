import { NextResponse } from "next/server";
import { getPublicLiveWebinarSession, resolveLiveParticipant } from "@/lib/live-webinars";
import { liveParticipantCookie, verifyLiveParticipantToken } from "@/lib/live-webinar-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const claims = verifyLiveParticipantToken(token);
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  try {
    if (!claims) return NextResponse.json({ error: "This joining link is invalid or has expired. Use the latest registration email." }, { status: 401, headers });
    const session = await getPublicLiveWebinarSession(claims.sessionId);
    const participant = session ? await resolveLiveParticipant(claims.sessionId, token) : null;
    if (!session || !participant) return NextResponse.json({ error: "This registration is no longer available." }, { status: 401, headers });
    const destination = url.searchParams.get("replay") === "1" ? "/live/replay" : "/live/room";
    const target = new URL(destination, url.origin);
    target.searchParams.set("session", session.id);
    const response = NextResponse.redirect(target, { status: 303, headers });
    response.cookies.set(liveParticipantCookie(session.id), token, { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", expires: new Date(claims.expiresAt) });
    return response;
  } catch {
    return NextResponse.json({ error: "We couldn't open your joining link. Please try again." }, { status: 503, headers });
  }
}
