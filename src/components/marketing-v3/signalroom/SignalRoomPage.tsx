"use client";

import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site-v3";
import { PlayIcon } from "@/components/marketing-v2/Icons";
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

/* Variant B — "Signal Room": audio-forensics, phosphor-green + gold. */
function HeroSignalRoom() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "100svh", paddingTop: 120 }}
    >
      <Image
        src="/v3/tex-water.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
        style={{ opacity: 0.16, filter: "grayscale(1) contrast(1.2)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 20%, color-mix(in srgb, var(--v3-accent) 10%, transparent), transparent 60%), linear-gradient(180deg, rgba(4,7,10,0.7), var(--v3-bg))",
        }}
      />

      <div
        className="v3-wrap relative text-center"
        style={{ animation: "fadeup 0.8s ease-out both" }}
      >
        {/* REC indicator + terminal */}
        <div className="flex items-center justify-center gap-3">
          <span
            className="v3-mono inline-flex items-center gap-2"
            style={{ fontSize: 11, letterSpacing: "0.24em", color: "var(--v3-accent)" }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--v3-accent)",
                boxShadow: "0 0 12px var(--v3-accent)",
                animation: "v3Fade 1s ease-in-out infinite alternate",
              }}
            />
            REC · {site.ev.kickers.hero}
          </span>
        </div>

        <h1
          className="v3-display mx-auto mt-8"
          style={{ fontSize: "clamp(46px,9vw,120px)", lineHeight: 0.88, maxWidth: 1000 }}
        >
          The calls stop. And you find out if{" "}
          <span className="v3-accent-text">they owe you.</span>
        </h1>

        {/* master waveform */}
        <div
          className="v3-wave playing mx-auto mt-10"
          style={{ height: 60, maxWidth: 720, justifyContent: "space-between" }}
        >
          {Array.from({ length: 90 }).map((_, k) => (
            <i
              key={k}
              style={{
                height: `${18 + ((k * 13) % 82)}%`,
                animationDelay: `${(k % 12) * 0.05}s`,
              }}
            />
          ))}
        </div>

        <p
          className="mx-auto mt-9"
          style={{ fontSize: "clamp(16px,1.7vw,19px)", color: "var(--v3-mut)", maxWidth: 620, lineHeight: 1.6 }}
        >
          {site.hero.subhead}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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

        <div className="mt-7 flex items-center justify-center gap-3">
          <span aria-hidden style={{ color: "var(--v3-accent-2)", letterSpacing: 2 }}>
            ★★★★★
          </span>
          <span className="v3-mono" style={{ fontSize: 13, color: "var(--v3-mut)" }}>
            {site.hero.rating.stars} · {site.hero.rating.count}
          </span>
        </div>
      </div>
    </section>
  );
}

export function SignalRoomPage() {
  return (
    <>
      <span id="top" />
      <Header />
      <HeroSignalRoom />
      <TrustMarquee />
      <PainMirror />
      <ReframeGather />
      <MeetVance />
      <MechanismPinned />
      <EvidenceLibrary variant="signalroom" />
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
