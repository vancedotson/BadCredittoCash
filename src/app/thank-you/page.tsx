import Link from "next/link";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { CheckIcon, PhoneIcon } from "@/components/marketing/Icons";

export const metadata: Metadata = {
  title: "You're registered",
  // Keep this page out of search results — it's a funnel step.
  robots: { index: false, follow: false },
};

/**
 * Confirmation page after a successful registration.
 * Natural place to fire a conversion pixel and set the next-step expectation.
 * On-brand navy header bar + warm, plain-spoken copy (voice guide).
 */
export default function ThankYouPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20 sm:py-28">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green text-white">
          <CheckIcon className="h-7 w-7" />
        </div>
        <h1 className="mt-6 text-3xl sm:text-4xl">You&apos;re in.</h1>
        <p className="mt-4 text-lg text-slate">
          Your seat is saved. Check your inbox — I just sent the link and the
          details. Watch when it&apos;s good for you.
        </p>

        <div className="mt-8 rounded-xl border border-mist bg-cloud p-6 text-left">
          <p className="font-heading font-semibold text-heading">What happens next</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-slate">
            <li>Confirm your email so you don&apos;t miss it.</li>
            <li>Watch the training — you&apos;ll see exactly how this works.</li>
            <li>If you have a case, book your free call from there.</li>
          </ol>
        </div>

        {/* Warm/in-crisis path — don't make someone being harassed wait */}
        <div className="mt-6 text-sm text-slate">
          Being harassed right now and can&apos;t wait?{" "}
          <a
            href={site.contact.phoneHref}
            className="inline-flex items-center gap-1 font-semibold text-trust hover:text-heading"
          >
            <PhoneIcon className="h-4 w-4" />
            Call {site.contact.phoneDisplay}
          </a>
        </div>

        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-mist px-6 py-3 font-heading text-sm font-semibold text-heading transition-colors hover:bg-cloud"
        >
          Back to home
        </Link>

        {/* TODO: fire your conversion pixel here (Meta/GA4) — confirmed registration. */}
      </div>
    </div>
  );
}
