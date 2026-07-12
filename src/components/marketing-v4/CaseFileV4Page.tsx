"use client";

import { site } from "@/config/site-v3";
import { HeaderV4 } from "./HeaderV4";
import { HeroV4 } from "./HeroV4";
import {
  Intro,
  PainMirror,
  MeetVance,
  Testimonials,
  HowItWorks,
  Faq,
  RiskReversal,
  Urgency,
  RegisterSection,
  Footer,
} from "../marketing-v3/shared/sections";
import {
  ReframeGather,
  MechanismPinned,
  ResultsLedger,
  EvidenceLibrary,
} from "../marketing-v3/shared/signature";
import { TrustStripSection } from "./truststrip/TrustStripSection";

/* v4 — the chosen "Case File" direction, iterated. Reuses the shared v3
   section library; overrides only the header (adds the gold beam) and the hero
   (city-forward background, cleaner file-number treatment, uncropped photo). */
export function CaseFileV4Page() {
  return (
    <>
      <span id="top" />
      <HeaderV4 />
      <HeroV4 />
      <TrustStripSection />
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
