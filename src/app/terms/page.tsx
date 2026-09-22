import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { site } from "@/config/site-v3";
import { termsPageMetadata } from "@/lib/route-metadata";

export const metadata: Metadata = termsPageMetadata;

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      summary="These terms govern your use of this website, its free training, contact forms, credit-check and report-upload features, and appointment-booking features."
    >
      <LegalSection title="Acceptance of these terms">
        <p>
          By accessing or using this website, submitting a form, or booking a call, you agree to these Terms of Service and acknowledge the <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the website.
        </p>
      </LegalSection>

      <LegalSection title="Website information is not legal advice">
        <p>
          Website content and free training provide general educational information about consumer credit reporting and debt collection. They are not legal advice, financial advice, a credit report, or a substitute for advice from a qualified attorney or other licensed professional.
        </p>
        <p>
          Using the website, sending information, or booking a call does not create an attorney-client relationship, fiduciary relationship, or paid service relationship.
        </p>
      </LegalSection>

      <LegalSection title="Services and separate agreements">
        <p>
          The strategy call is free. Pricing for any services varies depending on the issue and will be explained before you decide whether to move forward. No paid service begins, and no fee is due, merely because you use this website or book a call.
        </p>
        <p>
          Any paid engagement must be described in a separate written agreement that identifies the services, timing, price, payment terms, and any cancellation rights or disclosures required by applicable law. If a separate signed agreement conflicts with these website terms about the paid service, the signed agreement controls for that service.
        </p>
      </LegalSection>

      <LegalSection title="Credit-reporting information and results">
        <p>
          Vance Dotson offers assistance with seeking deletion of inaccurate, incomplete, or unverified information in accordance with the Fair Credit Reporting Act. Accurate and current negative information generally cannot be removed merely because it is unfavorable.
        </p>
        <p>
          Results vary and are not guaranteed. No statement, testimonial, example, timeline, or past result promises that a particular item will be deleted, a score will change, collector contact will stop, compensation will be available, or any other specific outcome will occur.
        </p>
        <p>
          You retain the right to dispute inaccurate or incomplete information yourself and to obtain copies of your consumer reports as provided by law.
        </p>
      </LegalSection>

      <LegalSection title="Appointments and communications">
        <p>
          Appointment availability may change. You agree to provide accurate contact and scheduling information and to notify us if you cannot attend. We may reschedule or cancel an appointment when reasonably necessary.
        </p>
        <p>
          When you request training, book a call, or otherwise contact us, you authorize service-related communications needed to respond to that request. Optional marketing email requires the separate consent shown on the registration form and can be withdrawn at any time.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You may not:</p>
        <ul>
          <li>Use the website for unlawful, fraudulent, abusive, or deceptive activity.</li>
          <li>Submit information you do not have authority to provide or impersonate another person.</li>
          <li>Probe, disrupt, overload, bypass, scrape, reverse engineer, or interfere with the website or its security.</li>
          <li>Copy, republish, sell, or exploit website content except for personal, noncommercial use or as permitted in writing.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Ownership">
        <p>
          The website, training, text, graphics, branding, and other content are owned by Vance Dotson or used with permission and are protected by applicable intellectual-property laws. These terms give you a limited, revocable, non-transferable right to use the website for its intended personal purpose.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services and links">
        <p>
          The website relies on third-party hosting, database, email, security, and calendar services and may link to independent websites. We do not control independent third-party content, availability, security, or privacy practices. Your use of a third party may be governed by that party’s terms and policies.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          To the fullest extent permitted by law, the website and free content are provided “as is” and “as available.” We do not warrant uninterrupted availability, error-free operation, or that website information will fit every situation. Nothing in these terms excludes a warranty or consumer right that cannot lawfully be excluded.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, Vance Dotson and authorized service providers will not be liable for indirect, incidental, special, consequential, or punitive damages arising from use of, or inability to use, the website or free content. This limitation does not apply where prohibited by law or to liability that cannot legally be limited.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These website terms are governed by the laws of the State of Oklahoma and applicable federal law, without overriding any mandatory consumer protection that applies to you. Any dispute concerning these website terms may be brought in a court with lawful jurisdiction in Oklahoma County, Oklahoma, unless applicable law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          We may update these terms as the website or applicable requirements change. The effective date at the top identifies the current version. Continued use after an update means the revised terms apply to later use.
        </p>
        <p>
          Questions may be sent to <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>, <a href={site.contact.phoneHref}>{site.contact.phoneDisplay}</a>, or {site.contact.officeAddress}.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
