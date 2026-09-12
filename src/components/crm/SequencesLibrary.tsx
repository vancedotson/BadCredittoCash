import Link from "next/link";
import { SEQUENCES, SEGMENT_SEQUENCES, type Sequence } from "@/config/sequences";
import { SEQUENCE_FOR_SEGMENT } from "@/lib/sequence-routing";
import { SEGMENTS_IN_ORDER } from "@/lib/segments";
import { SegmentBadge } from "@/components/crm/ui";
import { SequenceIcon } from "@/components/crm/SequenceIcon";
import styles from "./SequencesLibrary.module.css";

const byId: Record<string, Sequence> = { ...SEQUENCES, ...SEGMENT_SEQUENCES };
const GOALS: Record<string, string> = {
  pre_webinar: "Get registrants to actually watch the training.",
  nurture: "Keep non-bookers warm until they're ready to talk.",
  onboarding: "Prep a booked caller so the call is productive.",
  registered_no_show: "Win back people who signed up but never watched.",
  low_watch: "Re-hook people who dropped off in the first few minutes.",
  mid_watch: "Reinforce the method for people who saw the problem, not the fix.",
  high_watch: "Push warm, almost-there watchers to book the call.",
  offer_click_no_book: "Overcome the blocker for people who clicked but didn't book.",
  booking_abandon: "Rescue people who started booking and got interrupted.",
};

const LIFECYCLE = [
  { when: "A contact registers", sequence: "pre_webinar" },
  { when: "A contact books a call", sequence: "onboarding" },
];

const STEPS = [
  { title: "Behavior", description: "A contact registers, watches the training, clicks to book, or books a call." },
  { title: "Segment", description: "Their activity places them in a follow-up segment or a registration or booking moment." },
  { title: "Enroll", description: "The matching sequence is selected using the triggers below." },
  { title: "Schedule", description: "Eligible emails enter the queue using the sequence's delays and any booking time." },
  { title: "Send", description: "Due, eligible emails are sent through Resend. Temporary delivery failures retry, up to three attempts." },
];

const MERGE_FIELDS = [
  { token: "{{watch_link}}", meaning: "The link to the on-demand training room." },
  { token: "{{call_link}}", meaning: "The link to book a strategy call." },
  { token: "{{appointment_time}}", meaning: "The appointment time from the contact's booking details." },
  { token: "{{timezone}}", meaning: "The timezone supplied with the booking." },
];

/** Keep the full original copy, highlighting the fields replaced at send time. */
function withTokens(body: string): React.ReactNode[] {
  return body.split(/(\{\{[^}]+\}\})/g).map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part)
      ? <code key={i} className={styles.token}>{part}</code>
      : <span key={i}>{part}</span>,
  );
}

function SequenceCard({ seq }: { seq: Sequence }) {
  return (
    <details id={`sequence-${seq.id}`} data-sequence-id={seq.id} className={styles.sequenceCard}>
      <summary className={styles.sequenceSummary}>
        <span className={styles.emailIcon}><SequenceIcon name="email" /></span>
        <h3>{seq.name}</h3>
        <span className={styles.cardMetadata}>
          <span className={styles.emailCount}>{seq.emails.length} emails</span>
          {seq.id === "nurture" ? <span className={styles.referenceBadge}>Reference template</span> : null}
        </span>
        <p className={styles.goal}>{GOALS[seq.id]}</p>
        <span className={styles.cardBottomline}>
          <span className={styles.viewEmails}>
            <span className={styles.whenClosed}>View emails</span>
            <span className={styles.whenOpen}>Hide emails</span>
            <SequenceIcon name="chevron" className={styles.cardChevron} />
          </span>
        </span>
      </summary>
      <div className={styles.emailContent}>
        <p className={styles.trigger}>
          <span>{seq.id === "nurture" ? "Intended trigger" : "Trigger"}</span>
          {seq.trigger}
        </p>
        {seq.id === "nurture" ? (
          <p className={styles.referenceNote}>Reference copy only. This sequence is not automatically enrolled when other sequences end.</p>
        ) : null}
        <ol className={styles.emailList}>
          {seq.emails.map((email, i) => (
            <li key={i} className={styles.email}>
              <span className={styles.emailNumber}>{i + 1}</span>
              <div className={styles.emailDetails}>
                <p className={styles.emailDelay}>{email.delay}</p>
                <div className={styles.emailCopy}>
                  <h4>{email.subject}</h4>
                  <p>{withTokens(email.body)}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

export function SequencesLibrary() {
  const sequences = Object.values(byId);
  const emailCount = sequences.reduce((total, sequence) => total + sequence.emails.length, 0);
  const segmentRows = SEGMENTS_IN_ORDER.flatMap((segment) => {
    const sequence = SEQUENCE_FOR_SEGMENT[segment];
    return sequence ? [{ segment, sequence }] : [];
  });

  return (
    <div className={styles.libraryWorkspace}>
      <section id="sequence-library" aria-labelledby="sequence-library-heading" className={styles.library}>
        <header className={styles.sectionHeader}>
          <h2 id="sequence-library-heading">Sequence library</h2>
          <p>{sequences.length} sequences · {emailCount} emails · On-demand &amp; booking</p>
        </header>
        {[
          { heading: "Core sequences", items: [SEQUENCES.pre_webinar, SEQUENCES.onboarding, SEQUENCES.nurture] },
          { heading: "Segment follow-up paths", items: Object.values(SEGMENT_SEQUENCES) },
        ].map((group) => (
          <div key={group.heading} className={styles.sequenceGroup}>
            <h3 className={styles.groupHeading}>{group.heading}</h3>
            <div className={styles.sequenceGrid}>
              {group.items.map((sequence) => <SequenceCard key={sequence.id} seq={sequence} />)}
            </div>
          </div>
        ))}
        <p className={styles.scopeNote}>
          <SequenceIcon name="info" />
          <span>Live webinar emails follow each session&apos;s schedule. <Link href="/crm/webinars">View live webinars <span aria-hidden="true">→</span></Link></span>
        </p>
      </section>

      <details id="automation-map" className={styles.automation}>
        <summary className={styles.automationSummary}>
          <span className={styles.automationTitle}><SequenceIcon name="info" /><h2>How it works</h2></span>
          <span className={styles.processLabel}>Behavior → Segment → Enroll → Schedule → Send</span>
          <SequenceIcon name="chevron" className={styles.automationChevron} />
        </summary>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <div className={styles.stepHeading}><span>{index + 1}</span><h3>{step.title}</h3></div>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </details>

      <div className={styles.referenceGrid}>
        <section aria-labelledby="sequence-triggers-heading" className={styles.referenceCard}>
          <h2 id="sequence-triggers-heading">What triggers each sequence</h2>
          <p className={styles.referenceIntro}>Follow-up is matched to what a contact does.</p>
          <h3 className={styles.groupHeading}>Lifecycle</h3>
          <ul className={styles.routingList}>
            {LIFECYCLE.map((row) => (
              <li key={row.sequence}>
                <span className={styles.routingTrigger}>{row.when}</span>
                <Link href={`#sequence-${row.sequence}`}><span aria-hidden="true">→ </span>{byId[row.sequence].name}</Link>
              </li>
            ))}
          </ul>
          <h3 className={styles.groupHeading}>By segment</h3>
          <ul className={styles.routingList}>
            {segmentRows.map((row) => (
              <li key={row.segment}>
                <span className={styles.routingTrigger}><SegmentBadge segment={row.segment} /></span>
                <Link href={`#sequence-${row.sequence}`}><span aria-hidden="true">→ </span>{byId[row.sequence].name}</Link>
              </li>
            ))}
          </ul>
          <p className={styles.referenceNote}><Link href="#sequence-nurture">Long-term nurture</Link> is available as reference copy; it has no automatic enrollment trigger.</p>
        </section>

        <section id="merge-fields" aria-labelledby="merge-fields-heading" className={styles.referenceCard}>
          <h2 id="merge-fields-heading">Merge fields</h2>
          <p className={styles.referenceIntro}>The sender replaces these placeholders with the appropriate links and booking details when an email is sent.</p>
          <dl className={styles.mergeFields}>
            {MERGE_FIELDS.map((field) => (
              <div key={field.token}>
                <dt><code className={styles.token}>{field.token}</code></dt>
                <dd>{field.meaning}</dd>
              </div>
            ))}
          </dl>
          <Link href="/crm/settings#sequences" className={styles.settingsLink}>Review email settings <span aria-hidden="true">→</span></Link>
        </section>
      </div>
    </div>
  );
}
