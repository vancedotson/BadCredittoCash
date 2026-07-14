import Link from "next/link";
import { site } from "@/config/site";

/**
 * Branded 404. Leans on the site's case-file / dossier motif and the navy+gold
 * palette. Self-contained (no header/footer) and centered, mobile-first.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 py-16 text-center text-white">
      <Link href="/" className="mb-10 inline-flex items-center gap-2">
        <span className="font-heading text-xl font-bold tracking-tight text-white">{site.name}</span>
      </Link>

      <p
        className="text-[5.5rem] leading-none tracking-tight text-gold sm:text-[8rem]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        404
      </p>

      <h1 className="mt-3 text-3xl text-white sm:text-4xl">This page isn&apos;t in the file.</h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
        The link may be broken, or the page may have moved. Let&apos;s get you back to solid ground.
      </p>

      <div className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-gold px-7 py-3.5 font-heading text-base font-semibold text-ink transition-colors hover:bg-gold-deep"
        >
          Back to home
        </Link>
        <Link
          href="/v4"
          className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 font-heading text-base font-semibold text-white transition-colors hover:bg-white/10"
        >
          Watch the free training
        </Link>
      </div>

      <p className="mt-10 text-sm text-white/50">
        Need a hand? <a href={`mailto:${site.contact.email}`} className="text-gold hover:underline">{site.contact.email}</a>
      </p>
    </main>
  );
}
