"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site-v3";
import { track } from "@/lib/tracking";
import { Kicker, Reveal, SectionScan } from "./primitives";
import { useReveal, useRevealChildren } from "./hooks";
import { RegistrationFormV3 } from "./RegistrationFormV3";
import { PersonIcon, ChevronRightIcon } from "@/components/marketing-v2/Icons";
import type { V3Variant } from "./PageSwitcher";

/* ---------- On-load cinematic intro -------------------------------------- */
export function Intro({ label }: { label: string }) {
  const [hide, setHide] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setHide(true), reduce ? 200 : 1700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`v3-intro ${hide ? "hide" : ""}`} aria-hidden>
      <div className="v3-intro-ring" />
      <div>
        <div className="v3-intro-kicker">{label}</div>
        <div className="v3-intro-brand">VANCE DOTSON</div>
        <div className="v3-intro-line">
          <span />
        </div>
      </div>
    </div>
  );
}

/* ---------- Floating header ---------------------------------------------- */
export function Header() {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0.15) 70%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="v3-wrap flex items-center justify-between py-4">
        <Link href="#top" className="flex flex-col leading-none">
          <span
            className="v3-display"
            style={{ fontSize: 22, letterSpacing: "0.04em" }}
          >
            VANCE DOTSON
          </span>
          <span
            className="v3-mono"
            style={{
              fontSize: 9.5,
              letterSpacing: "0.22em",
              color: "var(--v3-accent)",
              marginTop: 3,
            }}
          >
            {site.ev.fileNo}
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {site.nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="v3-mono transition-colors hover:text-[var(--v3-accent)]"
              style={{
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--v3-mut)",
              }}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <Link
          href={site.cta.primary.href}
          className="v3-btn v3-btn-ghost hidden sm:inline-flex"
          style={{ minHeight: 42, fontSize: 13, padding: "0 18px" }}
        >
          {site.cta.secondary.label}
        </Link>
      </div>
    </header>
  );
}

/* ---------- Trust marquee ------------------------------------------------- */
export function TrustMarquee() {
  const items = [...site.trustBar, site.ev.established, site.ev.classification];
  const row = [...items, ...items];
  return (
    <div className="v3-marquee" style={{ background: "rgba(0,0,0,0.3)" }}>
      <div className="v3-marquee-track">
        {row.map((t, i) => (
          <span
            key={i}
            className="v3-mono inline-flex items-center gap-3"
            style={{
              padding: "12px 26px",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--v3-mut)",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "var(--v3-accent)",
              }}
            />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Pain mirror --------------------------------------------------- */
export function PainMirror() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="pain">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.pain}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5" >
          <span style={{ fontSize: "clamp(38px,6vw,74px)" }}>
            {site.painMirror.heading}
          </span>
        </Reveal>
        <div className="mt-10 grid gap-px" style={{ background: "var(--v3-line-soft)" }}>
          {site.painMirror.points.map((p, i) => (
            <div
              key={i}
              className="v3-reveal flex items-start gap-5 px-1 py-5"
              data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
              style={{ background: "var(--v3-bg)" }}
            >
              <span
                className="v3-mono shrink-0"
                style={{
                  fontSize: 12,
                  color: "var(--v3-accent)",
                  paddingTop: 3,
                  letterSpacing: "0.1em",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p
                style={{
                  fontSize: "clamp(17px,2.4vw,23px)",
                  color: "var(--v3-ink)",
                  lineHeight: 1.4,
                }}
              >
                {p}
              </p>
            </div>
          ))}
        </div>
        <Reveal className="mt-10">
          <p
            className="v3-serif-em"
            style={{ fontSize: "clamp(22px,3.4vw,34px)", color: "var(--v3-accent)" }}
          >
            {site.painMirror.pivot}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Meet Vance ---------------------------------------------------- */
export function MeetVance() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="meet">
      <SectionScan />
      <div className="v3-wrap grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]" ref={ref}>
        {/* photo dossier */}
        <Reveal className="relative">
          <div className="v3-panel v3-corner relative overflow-hidden" style={{ borderRadius: 4 }}>
            <span
              className="v3-mono absolute left-3 top-3 z-10"
              style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
            >
              PHOTO // ON FILE
            </span>
            <Image
              src="/vance2.png"
              alt="Vance Dotson"
              width={560}
              height={720}
              className="relative z-0 h-auto w-full object-cover"
              style={{ filter: "grayscale(0.25) contrast(1.05)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55))",
              }}
            />
            <span
              className="v3-mono absolute bottom-3 left-3 z-10"
              style={{ fontSize: 10.5, color: "var(--v3-mut)" }}
            >
              {site.hero.photoCaption}
            </span>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <Kicker>{site.ev.kickers.meet}</Kicker>
          </Reveal>
          <Reveal as="h2" className="v3-display mt-5">
            <span style={{ fontSize: "clamp(38px,6vw,72px)" }}>
              {site.meetVance.heading}
            </span>
          </Reveal>
          {site.meetVance.body.map((p, i) => (
            <Reveal key={i} className="mt-5" delay={((i % 3) + 1) as 1 | 2 | 3}>
              <p style={{ color: "var(--v3-mut)", fontSize: 17, lineHeight: 1.6, maxWidth: 560 }}>
                {p}
              </p>
            </Reveal>
          ))}
          <div className="mt-8 grid gap-px sm:grid-cols-3" style={{ background: "var(--v3-line-soft)" }}>
            {site.meetVance.stats.map((s, i) => (
              <div
                key={i}
                className="v3-reveal px-4 py-5"
                data-delay={((i % 3) + 1) as 1 | 2 | 3}
                style={{ background: "var(--v3-bg)" }}
              >
                <div
                  className="v3-display"
                  style={{ fontSize: 30, color: "var(--v3-accent)" }}
                >
                  {s.value}
                </div>
                <div
                  className="v3-mono mt-2"
                  style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--v3-faint)" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <Reveal className="mt-6">
            <p className="v3-serif-em" style={{ fontSize: 20, color: "var(--v3-ink)" }}>
              {site.meetVance.signoff}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- Testimonials -------------------------------------------------- */
export function Testimonials() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="statements">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.testimonials}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>
            {site.testimonials.heading}
          </span>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {site.testimonials.items.map((t, i) => (
            <div
              key={i}
              className="v3-reveal v3-panel p-6"
              data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
              style={{ borderRadius: 4 }}
            >
              <p
                className="v3-serif-em"
                style={{ fontSize: 22, color: "var(--v3-ink)", lineHeight: 1.35 }}
              >
                “{t.quote}”
              </p>
              <div className="mt-5 flex items-center gap-3">
                <span
                  className="grid place-items-center"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    border: "1px solid var(--v3-line)",
                    color: "var(--v3-faint)",
                  }}
                >
                  <PersonIcon className="h-5 w-5" />
                </span>
                <div>
                  <div style={{ fontSize: 14, color: "var(--v3-ink)" }}>{t.name}</div>
                  <div
                    className="v3-mono"
                    style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--v3-faint)" }}
                  >
                    {t.location} · {t.result}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p
          className="v3-mono mt-6"
          style={{ fontSize: 11, color: "var(--v3-faint)", letterSpacing: "0.08em" }}
        >
          ⚠️ Placeholder statements: real names, photos & permissions pending.
        </p>
      </div>
    </section>
  );
}

/* ---------- How it works -------------------------------------------------- */
export function HowItWorks() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="how">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.how}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>
            {site.howItWorks.heading}
          </span>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {site.howItWorks.steps.map((s, i) => (
            <div
              key={i}
              className="v3-reveal v3-panel relative p-7"
              data-delay={((i % 3) + 1) as 1 | 2 | 3}
              style={{ borderRadius: 4 }}
            >
              <span
                className="v3-display"
                style={{ fontSize: 48, color: "var(--v3-line)", lineHeight: 1 }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="v3-display mt-3" style={{ fontSize: 22, color: "var(--v3-ink)" }}>
                {s.title}
              </h3>
              <p className="mt-2" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.55 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ----------------------------------------------------------- */
export function Faq() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="faq">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.faq}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>
            The questions everyone asks.
          </span>
        </Reveal>
        <div className="mt-9 grid gap-3">
          {site.faq.map((f, i) => (
            <details
              key={i}
              className="v3-reveal v3-panel group"
              data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
              style={{ borderRadius: 4 }}
            >
              <summary
                className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 outline-none focus-visible:ring-2"
                style={{ listStyle: "none" }}
              >
                <span
                  className="v3-display"
                  style={{ fontSize: "clamp(19px,2.6vw,26px)", color: "var(--v3-ink)" }}
                >
                  {f.q}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 transition-transform group-open:rotate-90"
                  style={{ color: "var(--v3-accent)" }}
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </span>
              </summary>
              <p
                className="px-6 pb-6"
                style={{ fontSize: 16, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 760 }}
              >
                {f.a}
              </p>
            </details>
          ))}
        </div>
        <Reveal className="mt-8">
          <Link
            href={site.cta.primary.href}
            className="v3-btn v3-btn-primary v3-clip"
            onClick={() => track("cta_click", { where: "faq", variant: "v3" })}
          >
            Get my questions answered, free
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Risk reversal ------------------------------------------------- */
export function RiskReversal() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="risk">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.risk}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(38px,6vw,80px)", maxWidth: 900, display: "block" }}>
            {site.riskReversal.heading}
          </span>
        </Reveal>
        <div className="mt-9 grid gap-3 sm:grid-cols-2">
          {site.riskReversal.points.map((p, i) => (
            <div
              key={i}
              className="v3-reveal flex items-center gap-4 px-5 py-4"
              data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
              style={{ border: "1px solid var(--v3-line-soft)", borderRadius: 4 }}
            >
              <span style={{ color: "var(--v3-accent)", fontSize: 20 }}>✓</span>
              <span style={{ fontSize: 17, color: "var(--v3-ink)" }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Urgency ------------------------------------------------------- */
export function Urgency() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="urgency">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.urgency}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(34px,5vw,64px)" }}>{site.urgency.heading}</span>
        </Reveal>
        <ul className="mt-8 grid gap-4">
          {site.urgency.points.map((p, i) => (
            <li
              key={i}
              className="v3-reveal flex items-baseline gap-4"
              data-delay={((i % 3) + 1) as 1 | 2 | 3}
            >
              <span
                className="v3-mono shrink-0"
                style={{ color: "var(--v3-accent)", fontSize: 13 }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: "clamp(18px,2.6vw,26px)", color: "var(--v3-ink)" }}>
                {p}
              </span>
            </li>
          ))}
        </ul>
        <Reveal className="mt-7">
          <p className="v3-mono" style={{ fontSize: 13, color: "var(--v3-mut)" }}>
            {site.urgency.scarcity}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Register + final CTA ----------------------------------------- */
export function RegisterSection() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="v3-section" id="register" style={{ scrollMarginTop: 80 }}>
      <SectionScan />
      <div className="v3-wrap grid items-center gap-12 lg:grid-cols-2" ref={ref}>
        <div>
          <Kicker>{site.ev.kickers.register}</Kicker>
          <h2 className="v3-display mt-5" style={{ fontSize: "clamp(36px,5.4vw,72px)" }}>
            {site.finalCta.heading}
          </h2>
          <p className="mt-6" style={{ fontSize: 18, color: "var(--v3-mut)", lineHeight: 1.6, maxWidth: 520 }}>
            {site.register.body}
          </p>
          <div
            className="v3-mono mt-8 flex flex-col gap-2"
            style={{ fontSize: 12.5, color: "var(--v3-faint)", letterSpacing: "0.06em" }}
          >
            {site.ev.terminal.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="v3-panel v3-corner p-7 sm:p-9" style={{ borderRadius: 4 }}>
          <div className="mb-6 flex items-center justify-between">
            <span className="v3-display" style={{ fontSize: 24 }}>
              {site.register.heading}
            </span>
          </div>
          <RegistrationFormV3 />
          <p
            className="v3-mono mt-5 text-center"
            style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--v3-faint)" }}
          >
            {site.register.webinarNote}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer -------------------------------------------------------- */
export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--v3-line)", background: "var(--v3-bg2)" }}>
      <div className="v3-wrap py-14">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="v3-display" style={{ fontSize: 28, letterSpacing: "0.04em" }}>
              VANCE DOTSON
            </div>
            <div
              className="v3-mono mt-2"
              style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--v3-accent)" }}
            >
              {site.ev.classification}
            </div>
          </div>
          <nav className="flex gap-6">
            {site.footer.links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="v3-mono transition-colors hover:text-[var(--v3-accent)]"
                style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--v3-mut)" }}
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <div
          className="mt-10 grid gap-2 border-t pt-8"
          style={{ borderColor: "var(--v3-line-soft)" }}
        >
          {site.footer.disclaimers.map((d, i) => (
            <p key={i} style={{ fontSize: 12.5, color: "var(--v3-faint)", lineHeight: 1.5, maxWidth: 820 }}>
              {d}
            </p>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* re-export type for variant files */
export type { V3Variant };
