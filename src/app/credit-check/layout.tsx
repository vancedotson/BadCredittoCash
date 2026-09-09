import type { ReactNode } from "react";
import Link from "next/link";
import { site } from "@/config/site-v3";
import "../v3/v3.css";
import "./credit-check.css";

export default function CreditCheckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="v3 credit-check" data-variant="casefile">
      <a className="cc-skip" href="#credit-check-main">Skip to content</a>
      <header className="cc-header">
        <div className="cc-container cc-header-inner">
          <Link href="/" className="cc-brand" aria-label="Vance Dotson home">
            <span className="v3-display">VANCE DOTSON</span>
            <span className="cc-eyebrow">CONSUMER ADVOCATE · EST. 2004</span>
          </Link>
          <span className="cc-header-note"><span aria-hidden="true" /> THE 60-SECOND CHECK</span>
        </div>
      </header>
      {children}
      <footer className="cc-container cc-footer">
        <div className="w-full space-y-4 text-xs leading-relaxed">
          <div className="flex flex-wrap justify-between gap-5">
            <address className="not-italic">
              <strong>{site.name}</strong><br />
              {site.contact.officeAddress}<br />
              <a className="underline underline-offset-4" href={site.contact.phoneHref}>{site.contact.phoneDisplay}</a>
              {" · "}
              <a className="underline underline-offset-4" href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
            </address>
            <div className="space-y-2">
              <nav aria-label="Legal and contact" className="flex flex-wrap gap-5">
                {site.footer.links.map((link) => (
                  <Link key={link.label} className="underline underline-offset-4" href={link.href}>{link.label}</Link>
                ))}
              </nav>
              <p>Free. No judgment. No obligation.</p>
            </div>
          </div>
          <div className="max-w-4xl space-y-1">
            {site.footer.disclaimers.map((disclaimer) => <p key={disclaimer}>{disclaimer}</p>)}
          </div>
        </div>
      </footer>
    </div>
  );
}
