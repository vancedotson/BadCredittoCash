import { NextResponse } from "next/server";
import { getPublicLiveWebinarSession } from "@/lib/live-webinars";

const escapeIcs = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\r", "");
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export async function GET(request: Request) {
  try {
    const session = await getPublicLiveWebinarSession(new URL(request.url).searchParams.get("session"));
    if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bad Credit to Cash//Live Webinar//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
      `UID:${session.id}@badcredittocash.com`, `SEQUENCE:${session.scheduleVersion}`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(session.startsAt)}`, `DTEND:${stamp(session.endsAt)}`, `SUMMARY:${escapeIcs(session.title)}`,
      `DESCRIPTION:${escapeIcs("Use the personal joining link in your registration email. General information, not legal advice.")}`,
      `STATUS:${session.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
    return new Response(content, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${session.slug}.ics"`, "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Could not load calendar details." }, { status: 503 }); }
}
