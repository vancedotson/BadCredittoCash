"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { site } from "@/config/site-v3";
import { liveWebinar, agendaTotalMinutes } from "@/config/live-webinar";
import { Kicker, SectionScan, Reveal } from "@/components/marketing-v3/shared/primitives";
import { useReveal } from "@/components/marketing-v3/shared/hooks";
import { RegistrationFormV3 } from "@/components/marketing-v3/shared/RegistrationFormV3";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { SourceTime, TimeZonePicker } from "./EventTime";
import { UnscheduledNotice, PreviewBanner } from "./UnscheduledNotice";
import { sessionReplayAvailable, useLiveSession } from "./LiveSessionProvider";
import { useLiveClock, useEventPhase } from "./EventTime";

/**
 * /live — step 1 of the live webinar funnel: the registration page.
 *
 * The session's subject is collector conduct under the FDCPA — what a collector
 * is not allowed to do and how to respond — NOT reading a credit report. The
 * report/FCRA angle belongs to the evergreen funnel at /webinar/*.
 *
 * Section order follows the CRO wireframe library's 06_Webinar page:
 *   1. Topic-led hero with explicit live-event logistics
 *   2. What you'll actually see (format, not an authority badge)
 *   3. Agenda whose segments sum to the stated duration, Q&A separate
 *   4. Honest preparation
 *   5. Host, using only supplied information
 *   6. Registration, with the source time plus a zone selector
 *   7. Included vs. not promised — the legal-advice and outcome boundaries
 *   8. FAQ, then the same next step repeated
 *
 * Every event fact comes from src/config/live-webinar.ts. While that config's
 * `isScheduled` is false, this page refuses to present placeholder logistics as
 * a real event and renders UnscheduledNotice instead.
 */

const chipStyle: React.CSSProperties = {
  border: "1px solid var(--v3-line)",
  borderRadius: 999,
  padding: "6px 14px",
  fontSize: 12.5,
  letterSpacing: "0.06em",
  color: "var(--v3-mut)",
};

const registrationFormProps = {
  redirectTo: "/live/confirmed",
  source: "vance-live-webinar",
  showPhone: false,
  submitLabel: liveWebinar.registration.submitLabel,
  loadingLabel: liveWebinar.registration.loadingLabel,
  reassurance: liveWebinar.registration.reassurance,
} as const;

function ReviewableRegistrationForm({ idPrefix }: { idPrefix?: string }) {
  const { session, timezone, preview, href } = useLiveSession();
  const reviewState = useSearchParams().get("state");
  const previewState =
    reviewState === "registration-invalid"
      ? "invalid"
      : reviewState === "registration-error"
        ? "server-error"
        : reviewState === "registration-loading"
          ? "submitting"
          : undefined;

  return (
    <RegistrationFormV3
      key={`${preview ? "preview" : session?.id}:${previewState ?? "normal"}`}
      {...registrationFormProps}
      redirectTo={href("/live/confirmed")}
      sessionId={preview ? undefined : session?.id}
      timezone={timezone || undefined}
      disabledPreview={preview || !session || session.status !== "scheduled"}
      idPrefix={idPrefix}
      previewState={previewState}
    />
  );
}

const S = liveWebinar.sections;

function SectionHead({ index, kicker }: { index: string; kicker: string }) {
  return <Kicker>{`${index} // ${kicker}`}</Kicker>;
}

/** Section h2 — one config line per rendered line. */
function Heading({
  lines,
  size = "clamp(30px,4.2vw,52px)",
}: {
  lines: readonly string[];
  size?: string;
}) {
  return (
    <h2 className="v3-display mt-5" style={{ fontSize: size, lineHeight: 1.05 }}>
      {lines.map((line, i) => (
        <span key={line}>
          {i > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </h2>
  );
}

/* 1 — Hero: the topic and the logistics, together. */
function Hero() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section" style={{ paddingTop: 56 }}>
      {/* Three blocks, not two columns. On mobile they stack in DOM order —
          headline, FORM, supporting detail — so the form is reachable without a
          scroll. From lg up, explicit row/column placement rebuilds the
          two-column layout with both copy blocks stacked beside the form. */}
      <div
        className="v3-wrap grid items-start gap-x-12 gap-y-8 lg:grid-cols-2"
        ref={ref}
      >
        <div className="lg:col-start-1 lg:row-start-1">
          <Kicker>{liveWebinar.hero.kicker}</Kicker>
          <h1 className="v3-display mt-5" style={{ fontSize: "clamp(38px,5.6vw,72px)", lineHeight: 1.02 }}>
            {liveWebinar.hero.headlinePlain}{" "}
            <span style={{ color: "var(--v3-accent)" }}>{liveWebinar.hero.headlineAccent}</span>
          </h1>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 560 }}>
            {liveWebinar.hero.sub}
          </p>

        </div>

        {/* 2 — The form, above the fold. This is the page's primary conversion
            point; the section-04 form below is the repeat ask for people who
            scroll and read first. */}
        <div
          className="v3-panel v3-corner p-7 sm:p-9 lg:col-start-2 lg:row-start-1 lg:row-span-2"
          id="register-hero"
          style={{ borderRadius: 4 }}
        >
          <h2 className="v3-display" style={{ fontSize: 28, lineHeight: 1.1 }}>
            {liveWebinar.registration.heading}
          </h2>
          <p className="mt-3" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6 }}>
            {liveWebinar.registration.sub}
          </p>
          <p className="v3-mono mt-4" style={{ fontSize: 12, color: "var(--v3-accent)" }}>
            <SourceTime />
          </p>
          <div className="mt-6">
            <Suspense fallback={<RegistrationFormV3 {...registrationFormProps} idPrefix="live-hero" disabledPreview />}>
              <ReviewableRegistrationForm idPrefix="live-hero" />
            </Suspense>
          </div>
        </div>

        {/* 3 — Supporting detail. Below the form on mobile; back under the
            headline on desktop. Carries the three beats that used to sit in the
            file-number panel the form replaced. */}
        <div className="lg:col-start-1 lg:row-start-2">
          {/* The event chips sit below the form, not above it: the form panel
              already states the date, so repeating it above only pushed the
              email field off a phone screen. */}
          <div className="mb-8 flex flex-wrap gap-2.5">
            <span className="v3-mono" style={chipStyle}>
              <SourceTime />
            </span>
            <span className="v3-mono" style={chipStyle}>
              {liveWebinar.hero.format}
            </span>
          </div>

          <ul className="flex flex-wrap gap-x-8 gap-y-3">
            {liveWebinar.hero.walkthrough.lines.map((line) => (
              <li key={line} className="v3-display" style={{ fontSize: 24, lineHeight: 1.15 }}>
                <span style={{ color: "var(--v3-accent)" }}>/ </span>
                {line}
              </li>
            ))}
          </ul>
          <p className="v3-mono mt-4" style={{ fontSize: 11.5, color: "var(--v3-faint)" }}>
            {liveWebinar.hero.walkthrough.terminal}
          </p>

          <p className="mt-8" style={{ fontSize: 13.5, color: "var(--v3-faint)", lineHeight: 1.6 }}>
            Free. Hosted live by {liveWebinar.host.name}. Join online.
            <br />
            {liveWebinar.hero.walkthrough.caption}
          </p>
        </div>
      </div>
    </section>
  );
}

/* 3 — The agenda. Each segment has a distinct output; Q&A is its own block. */
function Agenda() {
  const ref = useReveal<HTMLDivElement>();
  const { session } = useLiveSession();
  const duration = session ? Math.round((Date.parse(session.endsAt) - Date.parse(session.startsAt)) / 60_000) : agendaTotalMinutes;
  const showTimings = duration === agendaTotalMinutes;
  return (
    <section className="v3-section">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <SectionHead
              index="01"
              kicker={S.agenda.kicker.replace("{DURATION}", String(duration))}
            />
            <Heading lines={S.agenda.headingLines} />
          </div>
          <p style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6, alignSelf: "end" }}>
            {showTimings ? S.agenda.note.replace("{TOTAL}", String(agendaTotalMinutes)) : "The session covers these topics, with time for questions."}
          </p>
        </div>

        <ol className="mt-12">
          {liveWebinar.agenda.map((segment, i) => {
            const start = liveWebinar.agenda.slice(0, i).reduce((s, x) => s + x.minutes, 0);
            return (
              <li key={segment.title} style={{ borderTop: "1px solid var(--v3-line-soft)" }}>
                <Reveal className="grid gap-4 py-7 sm:grid-cols-[110px_1fr]">
                <span
                  className="v3-mono"
                  style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--v3-accent)", paddingTop: 4 }}
                >
                  {showTimings ? `${String(start).padStart(2, "0")}–${start + segment.minutes} MIN` : `PART ${i + 1}`}
                </span>
                <div>
                  <h3 className="v3-display" style={{ fontSize: 22 }}>
                    {segment.title}
                  </h3>
                  <p className="mt-2" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 620 }}>
                    {segment.detail}
                  </p>
                </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* 4 — Preparation, stated honestly. */
function Bring() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <SectionHead index="02" kicker={S.bring.kicker} />
        <Heading lines={S.bring.headingLines} />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {liveWebinar.bring.map((item, i) => (
            <Reveal key={item.title} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <div className="v3-panel v3-corner h-full p-6" style={{ borderRadius: 4 }}>
                <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="v3-display mt-4" style={{ fontSize: 20 }}>
                  {item.title}
                </h3>
                <p className="mt-3" style={{ fontSize: 14.5, color: "var(--v3-mut)", lineHeight: 1.6 }}>
                  {item.detail}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 5 — The host, using only supplied information. */
function Host() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section">
      <SectionScan />
      <div className="v3-wrap grid items-center gap-12 lg:grid-cols-2" ref={ref}>
        <div>
          <SectionHead index="03" kicker={S.host.kicker} />
          <Heading lines={S.host.headingLines} />
        </div>
        <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
          <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}>
            {site.ev.classification}
          </span>
          <ul className="mt-5 flex flex-col gap-4">
            {liveWebinar.host.lines.map((line) => (
              <li key={line} style={{ fontSize: 15.5, color: "var(--v3-mut)", lineHeight: 1.6 }}>
                {line}
              </li>
            ))}
          </ul>
          <p className="v3-mono mt-6" style={{ fontSize: 11.5, color: "var(--v3-faint)" }}>
            &gt; {site.ev.established}
          </p>
        </div>
      </div>
    </section>
  );
}

/* 6 — Registration. Email only, source time explicit, zone selector alongside. */
function Register() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section" id="register" style={{ scrollMarginTop: 80 }}>
      <SectionScan />
      <div className="v3-wrap grid items-start gap-12 lg:grid-cols-2" ref={ref}>
        <div>
          <SectionHead index="04" kicker={S.register.kicker} />
          <Heading lines={S.register.headingLines} size="clamp(30px,4.6vw,56px)" />

          <p className="mt-7" style={{ fontSize: 17, color: "var(--v3-ink)", fontWeight: 500 }}>
            <SourceTime />
          </p>
          <p className="mt-2" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6 }}>
            Join online. The joining link is sent after you register.
          </p>

          <div className="mt-8">
            <TimeZonePicker />
          </div>
        </div>

        <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
          <h3 className="v3-display" style={{ fontSize: 28 }}>
            {liveWebinar.registration.heading}
          </h3>
          <p className="mt-3" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6 }}>
            {liveWebinar.registration.sub}
          </p>
          <div className="mt-7">
            <Suspense fallback={<RegistrationFormV3 {...registrationFormProps} disabledPreview />}>
              <ReviewableRegistrationForm />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 7 — The boundary: what is included, and what is explicitly not promised. */
function Boundaries() {
  const ref = useReveal<HTMLDivElement>();
  const { session } = useLiveSession();
  const now = useLiveClock();
  const notPromised = liveWebinar.notPromised.filter((line) => !sessionReplayAvailable(session, now) || line !== "A recording or replay.");
  const columns = [
    { title: "Included", items: liveWebinar.included, accent: "var(--v3-accent)" },
    { title: "Not promised", items: notPromised, accent: "var(--v3-faint)" },
  ];
  return (
    <section className="v3-section">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <SectionHead index="05" kicker={S.boundaries.kicker} />
        <Heading lines={S.boundaries.headingLines} />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {columns.map((col) => (
            <div key={col.title} className="v3-panel v3-corner p-7" style={{ borderRadius: 4 }}>
              <h3 className="v3-display" style={{ fontSize: 20 }}>
                {col.title}
              </h3>
              <ul className="mt-5 flex flex-col">
                {col.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 py-3"
                    style={{ borderTop: "1px solid var(--v3-line-soft)", fontSize: 15, color: "var(--v3-mut)" }}
                  >
                    <span style={{ color: col.accent, flexShrink: 0, marginTop: 2 }} aria-hidden>
                      <CheckIcon className="h-5 w-5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* 8 — FAQ, then the same next step. No new commitment introduced. */
function Faq() {
  const ref = useReveal<HTMLDivElement>();
  const { session } = useLiveSession();
  const now = useLiveClock();
  const items = liveWebinar.faq.map((item) => item.q === "Will there be a replay?" && sessionReplayAvailable(session, now)
    ? { ...item, a: "A recording is currently available for this session. Check your email for the replay link and access window." } : item);
  return (
    <section className="v3-section" id="faq">
      <SectionScan />
      <div className="v3-wrap grid gap-12 lg:grid-cols-[380px_1fr]" ref={ref}>
        <div>
          <SectionHead index="06" kicker={S.faq.kicker} />
          <Heading lines={S.faq.headingLines} size="clamp(28px,3.6vw,44px)" />
          <p className="mt-5" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.6 }}>
            {S.faq.note}
          </p>
        </div>
        <div>
          {items.map((item) => (
            <details
              key={item.q}
              className="py-5"
              style={{ borderTop: "1px solid var(--v3-line-soft)" }}
            >
              <summary
                className="v3-display cursor-pointer list-none"
                style={{ fontSize: 18, display: "flex", justifyContent: "space-between", gap: 16 }}
              >
                {item.q}
                <span style={{ color: "var(--v3-accent)", flexShrink: 0 }} aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.65, maxWidth: 640 }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section">
      <div
        className="v3-wrap flex flex-wrap items-center justify-between gap-6 py-10"
        ref={ref}
        style={{ borderTop: "1px solid var(--v3-line)" }}
      >
        <div>
          <h2 className="v3-display" style={{ fontSize: "clamp(24px,3vw,36px)", lineHeight: 1.1 }}>
            {liveWebinar.finalCta.heading}
            <br />
            <span style={{ color: "var(--v3-accent)" }}>{liveWebinar.finalCta.sub}</span>
          </h2>
          <p className="mt-4" style={{ fontSize: 14, color: "var(--v3-faint)" }}>
            Free live session. <SourceTime />.
          </p>
        </div>
        <a className="v3-btn v3-btn-primary" href="#register">
          {liveWebinar.ctaLabel} &nbsp;&rarr;
        </a>
      </div>
    </section>
  );
}

function RegistrationPage({ preview }: { preview: boolean }) {
  return (
    <main>
      {preview ? <PreviewBanner /> : null}
      <Hero />
      <Agenda />
      <Bring />
      <Host />
      <Register />
      <Boundaries />
      <Faq />
      <FinalCta />
    </main>
  );
}

/**
 * Gate: the real page only renders once the event is scheduled. `?preview=1`
 * lets the team review the finished page before that, behind an explicit banner
 * so a placeholder date is never mistaken for a real one.
 */
function GatedRegistrationPage() {
  const { session, preview, loading, error, href } = useLiveSession();
  const { phase } = useEventPhase();
  const now = useLiveClock();
  if (loading || !session || (!preview && (error || session.status !== "scheduled"))) return <UnscheduledNotice />;
  if (!preview && phase === "ended") {
    return <main className="v3-wrap" style={{ paddingTop: 72, paddingBottom: 120, maxWidth: 720 }}>
      <Kicker>SESSION ENDED</Kicker>
      <h1 className="v3-display mt-5" style={{ fontSize: 40 }}>This session has ended.</h1>
      <p className="mt-6" style={{ color: "var(--v3-mut)" }}>Registration for {session.title} is closed.</p>
      <div className="mt-8 flex flex-wrap gap-4">
        {sessionReplayAvailable(session, now) ? <Link className="v3-btn v3-btn-primary" href={href("/live/replay")}>Watch the replay</Link> : null}
        <Link className="v3-btn v3-btn-ghost" href={href("/live/call")}>Book a free call</Link>
      </div>
    </main>;
  }
  return <RegistrationPage preview={preview} />;
}

export function LiveRegisterSection() {
  return <GatedRegistrationPage />;
}
