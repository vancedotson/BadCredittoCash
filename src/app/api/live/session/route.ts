import { NextResponse } from "next/server";
import { getPublicLiveWebinarSession, resolveLiveParticipant } from "@/lib/live-webinars";

export async function GET(request: Request) {
  try {
    const session = await getPublicLiveWebinarSession(new URL(request.url).searchParams.get("session"));
    const participant = session ? await resolveLiveParticipant(session.id) : null;
    return NextResponse.json({ session, participant: participant ? { registrationId: participant.registrationId, sessionId: participant.sessionId } : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The live session could not be loaded. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
