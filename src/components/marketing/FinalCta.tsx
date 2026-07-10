import { site } from "@/config/site";
import { RegistrationForm } from "./RegistrationForm";
import { TrustBar } from "./TrustBar";
import { PhoneIcon } from "./Icons";

/**
 * SECTION 13 — Final CTA (Peak-End Close) + the registration/booking block.
 * This is the #register anchor every CTA on the page points to. Navy background
 * for the emotional close; serves the dual CTA: register for the webinar OR
 * (warm/in-crisis) call now. (structure §13 + registration)
 */
export function FinalCta() {
  return (
    <section id="register" className="scroll-mt-16 bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Emotional close */}
          <div>
            <h2 className="font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
              {site.finalCta.heading}
            </h2>
            <p className="mt-5 text-lg text-white/85">{site.register.body}</p>

            {/* Warm visitor path — call now */}
            <div className="mt-8 rounded-xl border border-white/15 bg-white/5 p-5">
              <p className="text-sm font-medium text-white/70">
                The calls won&apos;t stop and you want help today?
              </p>
              <a
                href={site.contact.phoneHref}
                className="mt-2 inline-flex items-center gap-2 font-heading text-2xl font-bold text-gold transition-colors hover:text-gold-deep"
              >
                <PhoneIcon className="h-6 w-6" />
                {site.contact.phoneDisplay}
              </a>
            </div>

            <TrustBar variant="onNavy" className="mt-8" />
          </div>

          {/* Cold visitor path — register for the webinar */}
          <div className="rounded-2xl bg-card p-6 shadow-card sm:p-8">
            <h3 className="text-xl text-heading">{site.register.heading}</h3>
            <p className="mt-1 text-sm text-slate">{site.register.webinarNote}</p>
            <div className="mt-6">
              <RegistrationForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
