import { site } from "@/config/site";

/**
 * SECTION 12 — Honest Urgency. Convert "someday" into "today" with REAL urgency
 * only — ongoing harm + genuine capacity limits. NO fake countdown timers
 * (they scream scam to this audience). White background. (structure §12)
 */
export function HonestUrgency() {
  return (
    <section className="bg-card">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20 text-center">
        <h2 className="text-3xl sm:text-4xl">{site.urgency.heading}</h2>

        <ul className="mx-auto mt-8 max-w-md space-y-3 text-left">
          {site.urgency.points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-lg text-body">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {point}
            </li>
          ))}
        </ul>

        <p className="mt-8 font-heading text-xl font-semibold text-heading">
          {site.urgency.scarcity}
        </p>
      </div>
    </section>
  );
}
