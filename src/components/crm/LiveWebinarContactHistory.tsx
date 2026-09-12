import Link from "next/link";
import type { LiveWebinarContactRegistration } from "@/lib/live-webinar-types";
import { formatLiveDate, liveParticipationLabel } from "@/lib/live-webinar-display";
import { Badge } from "./ui";
import { LiveWebinarMessages } from "./LiveWebinarMessages";

export function LiveWebinarContactHistory({ registrations }: { registrations: LiveWebinarContactRegistration[] }) {
  return <section aria-labelledby="contact-live-webinars-title">
    <h2 id="contact-live-webinars-title" className="mb-3 text-lg font-semibold text-heading">Live webinars</h2>
    {!registrations.length ? <p className="text-sm text-slate">No live webinar registrations yet.</p> : <ul className="space-y-4">
      {registrations.map((registration) => <li key={registration.id} className="space-y-2 rounded-xl border border-mist p-3">
        <Link href={`/crm/webinars?sessionId=${encodeURIComponent(registration.sessionId)}`} className="font-medium text-trust hover:underline">{registration.session.title}</Link>
        <p className="text-xs text-slate">{formatLiveDate(registration.session.startsAt, registration.session.timezone)}</p>
        <div className="flex flex-wrap gap-1.5"><Badge tone={registration.attendedAt ? "active" : "neutral"}>{liveParticipationLabel(registration)}</Badge>{registration.replayOpenedAt ? <Badge tone="info">Replay opened</Badge> : null}{registration.session.status === "cancelled" ? <Badge tone="warn">Session cancelled</Badge> : null}</div>
        <dl className="space-y-1 text-xs text-slate">
          <div>Registered: <span className="text-body">{formatLiveDate(registration.registeredAt, registration.session.timezone)}</span></div>
          {registration.firstRoomOpenedAt ? <div>First room entry: <span className="text-body">{formatLiveDate(registration.firstRoomOpenedAt, registration.session.timezone)}</span></div> : null}
          {registration.attendedAt ? <div>Session presence: <span className="text-body">{formatLiveDate(registration.attendedAt, registration.session.timezone)}</span></div> : null}
          {registration.replayOpenedAt ? <div>Replay opened: <span className="text-body">{formatLiveDate(registration.replayOpenedAt, registration.session.timezone)}</span></div> : null}
          {registration.bookingStatus ? <div>Call: <span className="text-body">{registration.bookingStatus}</span></div> : null}
        </dl>
        <LiveWebinarMessages messages={registration.messages} timezone={registration.session.timezone} />
      </li>)}
    </ul>}
  </section>;
}
