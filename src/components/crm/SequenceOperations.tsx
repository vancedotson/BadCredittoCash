"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SEQUENCES, SEGMENT_SEQUENCES } from "@/config/sequences";
import type { SequenceEnrollment, SequenceFailure, SequenceQueueStats } from "@/lib/store";
import { PlayIcon } from "@/components/marketing-v2/Icons";
import { SequenceIcon } from "./SequenceIcon";
import styles from "./SequenceOperations.module.css";

const sequenceNames: Record<string, string> = Object.fromEntries(
  [...Object.values(SEQUENCES), ...Object.values(SEGMENT_SEQUENCES)].map((sequence) => [sequence.id, sequence.name]),
);
sequenceNames.live_webinar = "Live webinar emails";
const shortNames: Record<string, string> = {
  pre_webinar: "Pre-webinar", onboarding: "Onboarding", nurture: "Long-term nurture",
  registered_no_show: "No-show follow-up", low_watch: "Low watch", mid_watch: "Mid watch", high_watch: "High watch",
  offer_click_no_book: "Clicked to book", booking_abandon: "Started booking", live_webinar: "Live webinar emails",
};
const sections = [
  ["enrollments", "Enrollments"], ["sequence-library", "Sequence library"],
  ["automation-map", "Automation map"], ["merge-fields", "Merge fields"],
] as const;

async function act(body: Record<string, string>) {
  const response = await fetch("/api/crm/sequences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "The sequence action failed.");
  }
  return await response.json() as { status?: string };
}

function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span aria-hidden="true" className={styles.avatar}>{initials || "?"}</span>;
}

export function SequenceOperations({ initialStats, initialEnrollments, initialFailures }: { initialStats: SequenceQueueStats; initialEnrollments: SequenceEnrollment[]; initialFailures: SequenceFailure[] }) {
  const [stats, setStats] = useState(initialStats);
  const [enrollments, setEnrollments] = useState(initialEnrollments);
  const [failures, setFailures] = useState(initialFailures);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState("enrollments");

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      setSection(sections.some(([id]) => id === hash) ? hash : hash.startsWith("sequence-") ? "sequence-library" : "enrollments");
    };
    const frame = requestAnimationFrame(sync);
    window.addEventListener("hashchange", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", sync); };
  }, []);

  function begin(id: string) {
    if (inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    setPending(new Set(inFlight.current));
    setError(""); setMessage("");
    return true;
  }

  function finish(id: string) {
    inFlight.current.delete(id);
    setPending(new Set(inFlight.current));
  }

  async function toggle(enrollment: SequenceEnrollment) {
    if (!begin(enrollment.id)) return;
    const action = enrollment.status === "active" ? "pause" : "resume";
    try {
      await act({ action, enrollmentId: enrollment.id });
      const status = action === "pause" ? "paused" as const : "active" as const;
      setEnrollments((current) => current.map((item) => item.id === enrollment.id ? { ...item, status } : item));
      setStats((current) => ({ ...current, activeEnrollments: Math.max(0, current.activeEnrollments + (action === "pause" ? -1 : 1)) }));
      const context = enrollment.sessionTitle ? " for " + enrollment.sessionTitle : "";
      setMessage(action === "pause" ? "Sequence paused" + context + ". Scheduled email is held." : "Sequence resumed" + context + ". Scheduled email can send again.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The sequence could not be changed.");
    } finally { finish(enrollment.id); }
  }

  async function retry(failure: SequenceFailure) {
    if (inFlight.current.has(failure.id)) return;
    if (!window.confirm("Retry " + failure.templateKey + " for " + failure.contactName + "? This queues the email to send again.")) return;
    if (!begin(failure.id)) return;
    try {
      const result = await act({ action: "retry", messageId: failure.id });
      setFailures((current) => current.filter((item) => item.id !== failure.id));
      if (result.status === "cancelled") {
        setStats((current) => ({ ...current, failedMessages: Math.max(0, current.failedMessages - 1) }));
        setMessage("Email cancelled by the outbound policy; no retry was queued.");
      } else {
        // A manual retry clears attempts, so it joins Scheduled, not Retrying.
        setStats((current) => ({ ...current, failedMessages: Math.max(0, current.failedMessages - 1), scheduledMessages: current.scheduledMessages + 1 }));
        setMessage("Failed email queued for retry.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The email could not be retried.");
    } finally { finish(failure.id); }
  }

  const metrics = [
    { label: "Active enrollments", value: stats.activeEnrollments, hint: "Across all enrollments", icon: "people", tone: "green" },
    { label: "Scheduled", value: stats.scheduledMessages, hint: "Including paused enrollments", icon: "clock", tone: "blue" },
    { label: "Retrying", value: stats.retryingMessages, hint: "Included in scheduled", icon: "retry", tone: "amber" },
    { label: "Sent", value: stats.sentMessages, hint: "Accepted by provider", icon: "sent", tone: "blue" },
    { label: "Failed", value: stats.failedMessages, hint: "Across all enrollments", icon: "alert", tone: "red" },
  ] as const;

  return (
    <div className={styles.operations}>
      <section aria-label="Sequence summary" className={styles.metrics}>
        {metrics.map((metric) => <div key={metric.label} className={styles.metric}>
          <span className={styles.metricValue}>{metric.value}</span>
          <span className={styles.metricIcon} data-tone={metric.tone}><SequenceIcon name={metric.icon} /></span>
          <span className={styles.metricLabel}>{metric.label}</span><span className={styles.metricHint}>{metric.hint}</span>
        </div>)}
      </section>

      <nav aria-label="Sequence sections" className={styles.sectionNav}>
        {sections.map(([id, title]) => <a key={id} href={"#" + id} aria-current={section === id ? "location" : undefined} onClick={() => setSection(id)}>{title}</a>)}
      </nav>

      {message ? <p role="status" className={styles.feedback} data-tone="success">{message}</p> : null}
      {error ? <p role="alert" className={styles.feedback} data-tone="error">{error}</p> : null}

      <div id="enrollments" className={styles.workspace}>
        <section aria-labelledby="sequence-enrollment-title" className={styles.queuePanel}>
          <div className={styles.panelHeading}>
            <div><h2 id="sequence-enrollment-title">Enrollment queue</h2><p>Latest active and paused enrollments</p></div>
            <span className={styles.shown}>{enrollments.length} shown</span>
          </div>
          {enrollments.length === 0 ? <p className={styles.empty}>No active or paused enrollments.</p> : (
            <div className={styles.queueScroll} role="region" aria-label="Recent enrollment rows" tabIndex={0}>
              <table className={styles.table}>
                <caption className="sr-only">The {enrollments.length} most recent active and paused enrollments</caption>
                <thead><tr><th scope="col">Contact</th><th scope="col">Sequence</th><th scope="col">Queue</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{enrollments.map((enrollment) => (
                  <tr key={enrollment.id} data-enrollment-id={enrollment.id}>
                    <td className={styles.contactCell}><div className={styles.identity}><Avatar name={enrollment.contactName} /><div className={styles.identityText}><Link href={"/crm/contacts/" + enrollment.contactId} className={styles.contactName}>{enrollment.contactName}</Link><span className={styles.email} title={enrollment.email}>{enrollment.email}</span></div></div></td>
                    <td className={styles.sequenceCell}><div className={styles.sequenceName} title={sequenceNames[enrollment.sequenceKey] ?? enrollment.sequenceKey}>{shortNames[enrollment.sequenceKey] ?? sequenceNames[enrollment.sequenceKey] ?? enrollment.sequenceKey}</div>{enrollment.sessionId ? <Link href={"/crm/webinars?sessionId=" + encodeURIComponent(enrollment.sessionId)} className={styles.sessionLink}>Session: {enrollment.sessionTitle || enrollment.sessionId}</Link> : null}</td>
                    <td className={styles.queueCell}><span>{enrollment.scheduledMessages} scheduled</span>{enrollment.nextScheduledAt ? <time suppressHydrationWarning dateTime={enrollment.nextScheduledAt} className={styles.nextSend}>Next {new Date(enrollment.nextScheduledAt).toLocaleString()}</time> : null}{enrollment.policyCancelledMessages ? <span className={styles.nextSend}>{enrollment.policyCancelledMessages} cancelled by launch policy</span> : null}</td>
                    <td className={styles.statusCell}><span className={styles.status} data-status={enrollment.status}>{enrollment.status === "active" ? "Active" : "Paused"}</span></td>
                    <td className={styles.actionCell}><button type="button" disabled={pending.has(enrollment.id)} aria-busy={pending.has(enrollment.id)} onClick={() => toggle(enrollment)} className={styles.secondaryButton}>{pending.has(enrollment.id) ? "Saving…" : enrollment.status === "active" ? "Pause" : "Resume"}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className={styles.queueNote}>Pause holds scheduled emails. Resume continues the queue.</p>
        </section>

        <aside className={styles.sideColumn}>
          <section aria-label="Permanent failures" className={styles.failurePanel}>
            <div className={styles.attentionHeading}><SequenceIcon name="alert" /><div><h2>Emails needing attention <span className={styles.failureCount}>{stats.failedMessages}</span></h2><p>{failures.length ? "Resolve the issue before retrying." : stats.failedMessages > 0 ? "Displayed failures cleared." : "No failed emails."}</p></div></div>
            {failures.length > 0 ? <><p className={styles.failureScope}>Latest {failures.length} failed email{failures.length === 1 ? "" : "s"} shown</p><div className={styles.failuresList}>{failures.map((failure) => {
              const template = failure.templateKey.match(/^(.+):(\d+)(?::.+)?$/);
              const sequenceName = template ? sequenceNames[template[1]] : undefined;
              return <article key={failure.id} className={styles.failureCard}>
                <div className={styles.identity}><Avatar name={failure.contactName} /><div className={styles.identityText}>{failure.contactId ? <Link href={"/crm/contacts/" + failure.contactId} className={styles.contactName}>{failure.contactName}</Link> : <span className={styles.contactName}>{failure.contactName}</span>}<span className={styles.email}>{failure.email}</span></div></div>
                <div><p className={styles.failureTemplate}>{sequenceName ?? failure.templateKey}</p><p className={styles.attempts}>{template && sequenceName ? "Email " + template[2] + " · " : ""}{failure.attempts} attempts</p></div>
                <p className={styles.providerError}>{failure.error}</p>
                <button type="button" disabled={pending.has(failure.id)} aria-busy={pending.has(failure.id)} onClick={() => retry(failure)} className={styles.retryButton}>{pending.has(failure.id) ? "Queuing…" : "Retry email"}</button>
                <details className={styles.deliveryDetails}><summary>Delivery details</summary><p>Template: <code>{failure.templateKey}</code></p><time suppressHydrationWarning dateTime={failure.failedAt}>{new Date(failure.failedAt).toLocaleString()}</time></details>
              </article>;
            })}</div></> : <p className={styles.empty}>{stats.failedMessages > 0 ? `${stats.failedMessages} failed email${stats.failedMessages === 1 ? " remains" : "s remain"}. Refresh this page to review them.` : "You’re all caught up. Refresh this page to check for new sending issues."}</p>}
          </section>
          <section className={styles.livePanel} aria-labelledby="sequence-live-title"><div className={styles.liveHeading}><span><PlayIcon className="h-4 w-4" /></span><h2 id="sequence-live-title">Live webinar emails</h2></div><p>Session-based emails also appear in the queue. Open a session to review its schedule and email settings.</p><Link href="/crm/webinars">Open live webinars →</Link></section>
        </aside>
      </div>
    </div>
  );
}
