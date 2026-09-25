import { NextResponse } from "next/server";
import { getPublicLiveWebinarSession, resolveLiveParticipant } from "@/lib/live-webinars";
import { cloudflareStreamConfigured } from "@/lib/cloudflare-stream";
import { createCloudflareLivePlaybackUrl } from "@/lib/cloudflare-stream-token";
import { isCloudflareWhepUrl } from "@/lib/live-webinar-types";
import { liveWebinar } from "@/config/live-webinar";

export async function GET(request: Request) {
  try {
    const session = await getPublicLiveWebinarSession(new URL(request.url).searchParams.get("session"));
    const resolvedParticipant = session ? await resolveLiveParticipant(session.id) : null;
    const participant = session && resolvedParticipant?.sessionId === session.id && resolvedParticipant.registrationId
      ? resolvedParticipant
      : null;
    let playbackUrl: string | null = null;
    const now = Date.now();
    if (session && participant && session.status === "scheduled" && session.streamProvider === "cloudflare"
      && session.cloudflareLiveInputId && session.embedUrl
      && now >= Date.parse(session.startsAt) - liveWebinar.room.doorsOpenMinutes * 60_000
      && now < Date.parse(session.endsAt)
      && cloudflareStreamConfigured()
      && isCloudflareWhepUrl(session.embedUrl, session.cloudflareLiveInputId)) {
      try {
        playbackUrl = await createCloudflareLivePlaybackUrl({ endpoint: session.embedUrl, liveInputId: session.cloudflareLiveInputId });
      } catch {
        // Missing or malformed signing configuration fails closed without provider detail.
      }
    }
    const publicSession = session ? {
      ...session,
      embedUrl: playbackUrl,
      replayUrl: null,
      replayPublished: false,
      replayAvailableUntil: null,
      cloudflareLiveInputId: null,
    } : null;
    return NextResponse.json({ session: publicSession, participant: participant ? { registrationId: participant.registrationId, sessionId: participant.sessionId } : null }, {
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Cookie" },
    });
  } catch {
    return NextResponse.json({ error: "The live session could not be loaded. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
