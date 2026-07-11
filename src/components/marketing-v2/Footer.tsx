import Link from "next/link";
import { site } from "@/config/site-v2";

/**
 * FOOTER (compliance-critical). Legitimacy + legal coverage. Navy bookend.
 * Disclaimers kept legible (14px min) — burying them in tiny gray signals
 * "hiding something." (structure: footer)
 *
 * ⚠️ All disclosures need CROA/FTC legal review and must match Vance's
 *    confirmed licensing/attorney status. Contact details are placeholders.
 */
export function Footer() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-heading text-lg font-bold">VANCE DOTSON</p>
            <p className="mt-2 text-sm text-white/70">{site.contact.officeAddress}</p>
            <a
              href={site.contact.phoneHref}
              className="mt-1 block text-sm text-white/70 transition-colors hover:text-gold"
            >
              {site.contact.phoneDisplay}
            </a>
            <a
              href={`mailto:${site.contact.email}`}
              className="text-sm text-white/70 transition-colors hover:text-gold"
            >
              {site.contact.email}
            </a>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {site.footer.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-white/70 transition-colors hover:text-gold"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Legible disclaimers (14px min) */}
        <div className="mt-10 space-y-2 border-t border-white/10 pt-8">
          {site.footer.disclaimers.map((line) => (
            <p key={line} className="text-sm leading-relaxed text-white/60">
              {line}
            </p>
          ))}
          <p className="pt-4 text-sm text-white/50">
            © {site.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
