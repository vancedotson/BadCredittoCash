"use client";

import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site-v3";
import { PlayIcon, CheckIcon } from "@/components/marketing-v2/Icons";
import {
  Header,
  Intro,
  TrustMarquee,
  PainMirror,
  MeetVance,
  Testimonials,
  HowItWorks,
  Faq,
  RiskReversal,
  Urgency,
  RegisterSection,
  Footer,
} from "../shared/sections";
import {
  ReframeGather,
  MechanismPinned,
  ResultsLedger,
  EvidenceLibrary,
} from "../shared/signature";

/* Variant A — "Case File": dossier-on-black, gold + document-cream. */
function HeroCaseFile() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "100svh", paddingTop: 96 }}
    >
      {/* OKC night skyline, heavily tinted */}
      <Image
        src="/oklahoma-night.png"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
        style={{ opacity: 0.28, filter: "grayscale(0.4) contrast(1.1)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,6,7,0.6), rgba(6,6,7,0.85) 60%, var(--v3-bg)), radial-gradient(ellipse 60% 50% at 30% 40%, color-mix(in srgb, var(--v3-accent) 10%, transparent), transparent 60%)",
        }}
      />

      <div
        className="v3-wrap relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]"
        style={{ minHeight: "calc(100svh - 96px)", animation: "fadeup 0.8s ease-out both" }}
      >
        {/* left column */}
        <div>
          <span className="v3-kicker">{site.ev.kickers.hero}</span>
          <h1
            className="v3-display mt-6"
            style={{ fontSize: "clamp(48px,8vw,104px)", lineHeight: 0.9 }}
          >
            The calls stop.{" "}
            <span className="v3-accent-text">Find out if they owe you.</span>
          </h1>
          <p
            className="mt-7"
            style={{ fontSize: "clamp(16px,1.7vw,19px)", color: "var(--v3-mut)", maxWidth: 560, lineHeight: 1.6 }}
          >
            {site.hero.subhead}
          </p>

          {/* rating token */}
          <div className="mt-7 flex items-center gap-3">
            <span aria-hidden style={{ color: "var(--v3-accent)", letterSpacing: 2 }}>
              ★★★★★
            </span>
            <span className="v3-mono" style={{ fontSize: 13, color: "var(--v3-mut)" }}>
              {site.hero.rating.stars} · {site.hero.rating.count}
            </span>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={site.cta.primary.href} className="v3-btn v3-btn-primary v3-clip" style={{ paddingLeft: 12 }}>
              <span className="v3-btn-badge">
                <PlayIcon className="h-4 w-4" />
              </span>
              {site.cta.primary.label}
            </Link>
            <Link href={site.cta.secondary.href} className="v3-btn v3-btn-ghost">
              {site.cta.secondary.label} →
            </Link>
          </div>

          {/* evidence checks */}
          <ul className="mt-9 grid gap-2.5">
            {site.hero.bullets.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span style={{ color: "var(--v3-accent)" }}>
                  <CheckIcon className="h-4 w-4" />
                </span>
                <span style={{ fontSize: 15, color: "var(--v3-ink)" }}>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* right column — photo evidence dossier */}
        <div className="relative hidden lg:block">
          <div className="v3-panel v3-corner relative overflow-hidden" style={{ borderRadius: 4 }}>
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--v3-line)" }}
            >
              <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-accent)" }}>
                {site.ev.fileNo}
              </span>
              <span className="v3-mono" style={{ fontSize: 10, letterSpacing: "0.2em", color: "var(--v3-faint)" }}>
                EXHIBIT — A
              </span>
            </div>
            <Image
              src="/vance.png"
              alt="Vance Dotson, consumer advocate"
              width={620}
              height={840}
              priority
              className="h-auto w-full object-cover"
              style={{ filter: "grayscale(0.15) contrast(1.05)", background: "#0a0a0b" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
              style={{ background: "linear-gradient(180deg, transparent, rgba(6,6,7,0.9))" }}
            />
            <span
              className="v3-mono absolute bottom-3 left-4"
              style={{ fontSize: 11, color: "var(--v3-mut)" }}
            >
              {site.hero.photoCaption}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CaseFilePage() {
  return (
    <>
      <span id="top" />
      <Header />
      <HeroCaseFile />
      <TrustMarquee />
      <PainMirror />
      <ReframeGather />
      <MeetVance />
      <MechanismPinned />
      <EvidenceLibrary variant="casefile" />
      <ResultsLedger />
      <Testimonials />
      <HowItWorks />
      <Faq />
      <RiskReversal />
      <Urgency />
      <RegisterSection />
      <Footer />
      <Intro label={site.ev.kickers.hero} />
    </>
  );
}
