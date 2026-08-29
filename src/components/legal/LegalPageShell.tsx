import type { ReactNode } from "react";
import Link from "next/link";
import { site } from "@/config/site-v3";

export function LegalPageShell({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-cloud text-body">
      <header className="border-b border-mist bg-darkblue text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Link href="/" className="font-heading text-lg font-semibold tracking-wide text-white">
            Vance Dotson
          </Link>
          <Link
            href="/book"
            className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Book a free call
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-trust">
          Effective August 29, 2026
        </p>
        <h1 className="mt-3 text-4xl leading-tight text-heading sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate">{summary}</p>

        <div className="mt-10 space-y-10 rounded-2xl border border-mist bg-card p-6 shadow-card sm:p-10">
          {children}
        </div>
      </article>

      <footer className="border-t border-mist bg-card">
        <div className="mx-auto grid max-w-5xl gap-5 px-5 py-8 text-sm text-slate sm:grid-cols-[1fr_auto] sm:px-8">
          <address className="not-italic">
            <strong className="text-heading">Vance Dotson</strong><br />
            {site.contact.officeAddress}<br />
            <a className="underline underline-offset-4" href={site.contact.phoneHref}>{site.contact.phoneDisplay}</a>
            {" · "}
            <a className="underline underline-offset-4" href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
          </address>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
            <Link className="underline underline-offset-4" href="/privacy">Privacy</Link>
            <Link className="underline underline-offset-4" href="/terms">Terms</Link>
            <Link className="underline underline-offset-4" href="/">Home</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-2xl text-heading">{title}</h2>
      <div className="space-y-3 leading-7 text-body [&_a]:font-medium [&_a]:text-trust [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}
