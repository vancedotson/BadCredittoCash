import { site } from "@/config/site-v2";
import { RegistrationForm } from "./RegistrationForm";

/**
 * SECTIONS 12 + 13 — merged close. The emotional "you've been carrying this
 * alone" line + the honest "why now" urgency reasons (left) sit beside the
 * registration/booking form (right). #register is the anchor every CTA points
 * to. Off-white background. Real urgency only — no fake timers.
 */
export function FinalCta() {
  const { urgency, finalCta, register } = site;
  return (
    <section id="register" className="scroll-mt-16 bg-cloud">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          {/* left — emotional close + honest urgency */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">
              Why now
            </p>
            <h2 className="mt-4 text-4xl leading-[1.06] sm:text-5xl">
              {finalCta.heading}
            </h2>

            <div className="mt-8">
              <p className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-gold-deep">
                {urgency.heading}
              </p>
              <ul className="mt-4 space-y-3">
                {urgency.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-lg text-body">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* right — registration / booking form */}
          <div className="rounded-2xl border border-mist bg-card p-6 shadow-card sm:p-8">
            <h3 className="text-xl text-heading">{register.heading}</h3>
            <p className="mt-1 text-sm text-slate">{register.webinarNote}</p>
            <div className="mt-6">
              <RegistrationForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
