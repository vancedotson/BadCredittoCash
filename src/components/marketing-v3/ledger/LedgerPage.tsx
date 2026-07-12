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

/* Variant C — "Blacksite Ledger": brutalist high-contrast noir, gold-only. */
function HeroLedger() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ minHeight: "100svh", paddingTop: 96 }}
    >
      {/* heavy grid */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--v3-line-soft) 1px, transparent 1px), linear-gradient(90deg, var(--v3-line-soft) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "linear-gradient(180deg, #000, transparent 92%)",
        }}
      />

      <div
        className="v3-wrap relative grid items-stretch gap-0 lg:grid-cols-[1fr_320px]"
        style={{ minHeight: "calc(100svh - 96px)", animation: "fadeup 0.8s ease-out both" }}
      >
        <div className="flex flex-col justify-center py-16">
          <div className="flex items-center gap-4">
            <span className="v3-kicker">{site.ev.kickers.hero}</span>
            <span className="v3-mono" style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--v3-faint)" }}>
              {site.ev.established}
            </span>
          </div>

          <h1
            className="v3-display mt-8"
            style={{ fontSize: "clamp(52px,11vw,150px)", lineHeight: 0.82, letterSpacing: "0.005em" }}
          >
            The calls
            <br />
            stop. <span className="v3-accent-text">And</span>
            <br />
            they owe
            <br />
            <span className="v3-accent-text">you.</span>
          </h1>

          <div
            className="mt-10 flex flex-wrap items-center gap-5"
            style={{ borderTop: "1px solid var(--v3-line)", paddingTop: 28 }}
          >
            <Link
              href={site.cta.primary.href}
              className="v3-btn v3-btn-primary"
              style={{ paddingLeft: 12, borderRadius: 0 }}
            >
              <span className="v3-btn-badge" style={{ borderRadius: 0 }}>
                <PlayIcon className="h-4 w-4" />
              </span>
              {site.cta.primary.label}
            </Link>
            <Link
              href={site.cta.secondary.href}
              className="v3-btn v3-btn-ghost"
              style={{ borderRadius: 0 }}
            >
              {site.cta.secondary.label} →
            </Link>
            <span className="v3-mono" style={{ fontSize: 12.5, color: "var(--v3-mut)" }}>
              ★★★★★ {site.hero.rating.stars} · {site.hero.rating.count}
            </span>
          </div>

          <p
            className="mt-8"
            style={{ fontSize: "clamp(15px,1.5vw,18px)", color: "var(--v3-mut)", maxWidth: 620, lineHeight: 1.6 }}
          >
            {site.hero.subhead}
          </p>
        </div>

        {/* tall photo strip */}
        <div
          className="relative hidden lg:block"
          style={{ borderLeft: "1px solid var(--v3-line)" }}
        >
          <Image
            src="/vance.png"
            alt="Vance Dotson, consumer advocate"
            fill
            priority
            sizes="320px"
            className="object-cover object-top"
            style={{ filter: "grayscale(0.6) contrast(1.15)", background: "#050505" }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85)), linear-gradient(90deg, rgba(0,0,0,0.4), transparent 30%)",
            }}
          />
          <span
            className="v3-mono absolute bottom-4 left-4"
            style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--v3-mut)" }}
          >
            {site.hero.photoCaption}
          </span>
        </div>
      </div>
    </section>
  );
}

export function LedgerPage() {
  return (
    <>
      <span id="top" />
      <Header />
      <HeroLedger />
      <TrustMarquee />
      <PainMirror />
      <ReframeGather />
      <MeetVance />
      <MechanismPinned />
      <EvidenceLibrary variant="ledger" />
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
