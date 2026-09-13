"use client";

import Image from "next/image";
import { liveWebinar } from "@/config/live-webinar";
import { CheckIcon } from "@/components/marketing-v2/Icons";
import { Kicker } from "@/components/marketing-v3/shared/primitives";
import { SourceTime, TimeZonePicker } from "../EventTime";
import {
  BigCountdown,
  LiveRegistrationForm,
  RegisterAnchor,
  StickyRegisterBar,
  useFaqItems,
  useSessionDurationMinutes,
} from "./shared";

/**
 * Version 1 — "Value + Form".
 *
 * The wireframe encyclopedia's recommended V4 recipe for a webinar registration
 * page, in order:
 *   Hero + Registration (Value + Form) → What you'll learn (outcome cards) →
 *   Agenda (timeline) → Speaker (expert profile) → Who it's for (role columns)
 *   → Logistics (info card row) → FAQ (accordion) → Final signup (centered band)
 *
 * The form is in the first screen on desktop and directly under the headline on
 * mobile, and a second form closes the page. A sticky bar on phones keeps the
 * ask one tap away in between.
 */

const P = liveWebinar.registrationPage;

function AnnouncementBar() {
  return (
    <div className="lr-announce">
      <div className="v3-wrap lr-announce-inner">
        <span className="lr-announce-live" aria-hidden />
        <span className="v3-mono lr-announce-label">{P.announcement}</span>
        <span className="lr-announce-date"><SourceTime showDuration={false} /></span>
        <span className="lr-announce-countdown"><BigCountdown compact /></span>
        <a className="lr-announce-link" href="#register-hero">{liveWebinar.ctaLabel} →</a>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="lr-section lr-hero-v1">
      {/* Three blocks, not two columns: on phones they stack headline → FORM →
          supporting copy so the email field is in the first screen; from lg up
          grid placement puts both copy blocks beside the form. */}
      <div className="v3-wrap lr-hero-v1-grid">
        <div className="lr-hero-v1-head">
          <Kicker>{liveWebinar.hero.kicker}</Kicker>
          <h1 className="v3-display lr-h1">
            {liveWebinar.hero.headlinePlain}{" "}
            <span className="lr-accent">{liveWebinar.hero.headlineAccent}</span>
          </h1>
        </div>

        <div className="lr-form-card lr-hero-v1-form" id="register-hero">
          <p className="v3-mono lr-form-kicker">{P.announcement}</p>
          <h2 className="v3-display lr-form-title">{liveWebinar.registration.heading}</h2>
          <div className="lr-form-when">
            <span className="v3-mono">WHEN</span>
            <strong><SourceTime /></strong>
          </div>
          <LiveRegistrationForm idPrefix="live-hero" />
        </div>

        <div className="lr-hero-v1-body">
          <p className="lr-lead">{liveWebinar.hero.sub}</p>

          <ul className="lr-bullets">
            {P.outcomes.map((o) => (
              <li key={o.title}>
                <CheckIcon className="h-5 w-5" />
                <span>{o.title}</span>
              </li>
            ))}
          </ul>

          <div className="lr-byline">
            <span className="lr-byline-photo">
              <Image src="/vance-avatar.png" alt="" width={56} height={56} sizes="56px" />
            </span>
            <span>
              <strong>Hosted live by {P.speaker.name}</strong>
              <small>{P.speaker.credentials[0]}</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <div className="lr-trust">
      <ul className="v3-wrap lr-trust-list">
        {P.trust.map((fact) => (
          <li key={fact} className="v3-mono">{fact}</li>
        ))}
      </ul>
    </div>
  );
}

function Outcomes() {
  return (
    <section className="lr-section">
      <div className="v3-wrap">
        <Kicker>WHAT YOU&apos;LL LEARN</Kicker>
        <h2 className="v3-display lr-h2">Leave knowing exactly where the line is.</h2>
        <div className="lr-card-grid">
          {P.outcomes.map((o, i) => (
            <article key={o.title} className="lr-card">
              <span className="v3-mono lr-card-num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="v3-display">{o.title}</h3>
              <p>{o.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Agenda() {
  const duration = useSessionDurationMinutes();
  const total = liveWebinar.agenda.reduce((sum, s) => sum + s.minutes, 0);
  const showTimings = duration === total;
  return (
    <section className="lr-section">
      <div className="v3-wrap lr-split">
        <div>
          <Kicker>{`THE ${duration}-MINUTE PLAN`}</Kicker>
          <h2 className="v3-display lr-h2">What happens, minute by minute.</h2>
          <p className="lr-muted">Three teaching segments, then open Q&amp;A.</p>
        </div>
        <ol className="lr-timeline">
          {liveWebinar.agenda.map((segment, i) => {
            const start = liveWebinar.agenda.slice(0, i).reduce((s, x) => s + x.minutes, 0);
            return (
              <li key={segment.title}>
                <span className="v3-mono lr-timeline-time">
                  {showTimings ? `${String(start).padStart(2, "0")}–${start + segment.minutes} MIN` : `PART ${i + 1}`}
                </span>
                <div>
                  <h3 className="v3-display">{segment.title}</h3>
                  <p>{segment.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Speaker() {
  return (
    <section className="lr-section">
      <div className="v3-wrap lr-speaker">
        <div className="lr-speaker-photo">
          <Image
            src="/vance2.png"
            alt="Vance Dotson, consumer advocate"
            fill
            sizes="(min-width: 1024px) 420px, 90vw"
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        </div>
        <div>
          <Kicker>{P.speaker.kicker}</Kicker>
          <h2 className="v3-display lr-h2">{P.speaker.name}</h2>
          <p className="v3-mono lr-speaker-role">{P.speaker.role}</p>
          <blockquote className="lr-quote">&ldquo;{P.speaker.quote}&rdquo;</blockquote>
          <ul className="lr-bullets">
            {P.speaker.credentials.map((c) => (
              <li key={c}>
                <CheckIcon className="h-5 w-5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function WhoFor() {
  return (
    <section className="lr-section">
      <div className="v3-wrap">
        <Kicker>{P.whoFor.kicker}</Kicker>
        <h2 className="v3-display lr-h2">{P.whoFor.heading}</h2>
        <div className="lr-card-grid">
          {P.whoFor.items.map((item) => (
            <article key={item.title} className="lr-card lr-card-plain">
              <h3 className="v3-display">{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
        <div className="lr-center-cta">
          <RegisterAnchor target="register-final" label="That's me — save my seat" />
        </div>
      </div>
    </section>
  );
}

function Logistics() {
  const duration = useSessionDurationMinutes();
  const cards = [
    { label: "WHEN", value: <SourceTime showDuration={false} />, note: "Starts on time — runs once" },
    { label: "LENGTH", value: `${duration} minutes`, note: "Including live Q&A" },
    { label: "WHERE", value: P.logistics.where, note: P.logistics.whereNote },
    { label: "COST", value: P.logistics.cost, note: P.logistics.costNote },
  ];
  return (
    <section className="lr-section">
      <div className="v3-wrap">
        <Kicker>{P.logistics.kicker}</Kicker>
        <div className="lr-logistics">
          {cards.map((card) => (
            <div key={card.label} className="lr-logistic">
              <span className="v3-mono">{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </div>
          ))}
        </div>
        <div className="lr-tz">
          <TimeZonePicker />
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = useFaqItems();
  return (
    <section className="lr-section" id="faq">
      <div className="v3-wrap lr-split">
        <div>
          <Kicker>QUESTIONS</Kicker>
          <h2 className="v3-display lr-h2">Before you save a seat.</h2>
        </div>
        <div className="lr-faq">
          {items.map((item) => (
            <details key={item.q}>
              <summary className="v3-display">
                {item.q}
                <span aria-hidden>+</span>
              </summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalBand() {
  return (
    <section className="lr-section lr-final">
      <div className="v3-wrap lr-final-inner">
        <h2 className="v3-display lr-h2">{P.finalBand.heading}</h2>
        <p className="lr-lead">{P.finalBand.sub}</p>
        <BigCountdown />
        <div className="lr-form-card lr-form-card-center" id="register-final">
          <h3 className="v3-display lr-form-title">{liveWebinar.registration.heading}</h3>
          <p className="lr-form-when-inline"><SourceTime /></p>
          <LiveRegistrationForm idPrefix="live-v1-final" />
        </div>
      </div>
    </section>
  );
}

export function LiveRegisterV1() {
  return (
    <>
      <AnnouncementBar />
      <Hero />
      <TrustStrip />
      <Outcomes />
      <Agenda />
      <Speaker />
      <WhoFor />
      <Logistics />
      <Faq />
      <FinalBand />
      <StickyRegisterBar watchIds="register-hero register-final" target="register-final" />
    </>
  );
}
