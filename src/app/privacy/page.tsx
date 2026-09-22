import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { site } from "@/config/site-v3";
import { privacyPageMetadata } from "@/lib/route-metadata";

export const metadata: Metadata = privacyPageMetadata;

const privacyRequestHref = `mailto:${site.contact.email}?subject=Privacy%20request`;

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      summary="This policy explains what information we collect through this website, why we use it, who helps us process it, and the choices available to you."
    >
      <LegalSection title="Who we are">
        <p>
          This website is operated by Vance Dotson. References to “we,” “us,” and “our” mean Vance Dotson and the people authorized to support this business.
        </p>
        <p>
          Contact: <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>, <a href={site.contact.phoneHref}>{site.contact.phoneDisplay}</a>, or {site.contact.officeAddress}.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <ul>
          <li><strong>Contact and registration information:</strong> name, email address, phone number, and the source of your inquiry. A phone number is required for the credit check and optional where other forms indicate.</li>
          <li><strong>Credit-check and report information:</strong> questionnaire answers, credit-report PDFs you choose to upload, the selected bureau, filenames, file sizes, and submission and upload receipts. Reports may contain sensitive identity, account, and credit-history information.</li>
          <li><strong>Booking information:</strong> appointment date and time, time zone, intake answers, and calendar details needed to schedule or manage a call.</li>
          <li><strong>Communications and service records:</strong> messages, call or appointment history, consent status, notes, tasks, and other records needed to respond to you or provide requested services.</li>
          <li><strong>Website and attribution information:</strong> page visited, referring page, campaign parameters, click identifiers, a randomly generated visitor identifier, browser or device information in service logs, and an IP-derived country code where available.</li>
          <li><strong>Email activity:</strong> delivery, bounce, complaint, suppression, and unsubscribe status used to operate and protect the email program.</li>
        </ul>
        <p>
          Use only the designated credit-report upload controls to send the reports requested by the credit-check guide. Do not enter Social Security numbers or account passwords in the questionnaire or send full reports through ordinary contact forms or email.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul>
          <li>Provide requested training, respond to inquiries, review whether a strategy call may be appropriate, and schedule appointments.</li>
          <li>Connect the credit-check answers and uploaded reports to your contact record so Vance and authorized reviewers can review your request.</li>
          <li>Send service, appointment, security, and account-related communications.</li>
          <li>Send optional follow-up tips or marketing messages when you choose to receive them.</li>
          <li>Operate the CRM, maintain contact history, measure funnel performance, prevent duplicate submissions, and improve the website.</li>
          <li>Detect spam, abuse, fraud, security incidents, and technical problems.</li>
          <li>Comply with law, enforce our terms, and establish or defend legal claims.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Email choices" id="email-choices">
        <p>
          Marketing consent is optional. You may unsubscribe at any time using the unsubscribe link in a marketing email. The request is recorded immediately in our system. You may also email <a href={`mailto:${site.contact.email}?subject=Unsubscribe%20request`}>{site.contact.email}</a>.
        </p>
        <p>
          After opting out of marketing, we may still send necessary messages about an appointment, request, account, security matter, or an active service relationship.
        </p>
      </LegalSection>

      <LegalSection title="How we share information">
        <p>We do not sell personal information. We may disclose information only as reasonably needed to:</p>
        <ul>
          <li>Use service providers that host or support the website, database, email delivery, spam protection, CRM, and calendar scheduling, including Cloudflare, Supabase, Resend, and Google.</li>
          <li>Work with authorized staff, contractors, and professional advisers who need the information to perform services and are expected to protect it.</li>
          <li>Comply with a lawful request, protect rights or safety, investigate abuse, or complete a business transfer subject to appropriate protections.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          The site uses local browser storage and similar first-party technology to remember a visitor identifier, registration details across funnel steps, first-touch attribution, and session state. Cloudflare Turnstile may use necessary technology to distinguish legitimate visitors from automated abuse.
        </p>
        <p>
          Report uploads use a session cookie and a personal desktop link to connect your uploads to your credit check. Keep that personal link private. Upload access expires after seven days; this does not mean previously received reports are automatically deleted.
        </p>
        <p>
          The site does not currently load GA4, Meta Pixel, or Google Ads tracking tags. If additional advertising or analytics technology is introduced, this policy and any legally required consent controls will be updated before that technology is used.
        </p>
      </LegalSection>

      <LegalSection title="Retention and security">
        <p>
          We retain information for as long as reasonably necessary to respond to you, provide services, operate the business, maintain required records, resolve disputes, prevent abuse, and meet legal obligations. Suppression records may be retained so we can continue honoring an unsubscribe request. Information that is no longer needed may be deleted or de-identified.
        </p>
        <p>
          We use administrative, technical, and organizational safeguards designed to protect information. No online system or transmission method can be guaranteed completely secure.
        </p>
      </LegalSection>

      <LegalSection title="Your privacy choices" id="your-choices">
        <p>
          Depending on applicable law and the nature of our relationship, you may ask to access, correct, export, or delete information associated with you, or ask us to stop marketing communications. Send requests to <a href={privacyRequestHref}>{site.contact.email}</a> with the subject “Privacy request.”
        </p>
        <p>
          We may need to verify your identity before completing a request. Some information may be retained where required by law or reasonably necessary for security, fraud prevention, recordkeeping, disputes, or to honor an opt-out.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          This website is intended for adults and is not directed to children under 18. We do not knowingly collect personal information from children through the public funnel. A parent or guardian who believes a child submitted information may contact us to request deletion.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy when our practices or legal obligations change. The effective date at the top identifies the current version. Material changes will be communicated when required by law.
        </p>
        <p>See also our <Link href="/terms">Terms of Service</Link>.</p>
      </LegalSection>
    </LegalPageShell>
  );
}
