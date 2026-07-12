"use client";

import { site } from "@/config/site-v3";
import { HeaderV4 } from "./HeaderV4";
import { HeroV4 } from "./HeroV4";
import {
  Intro,
  Faq,
  RiskReversal,
  Urgency,
  RegisterSection,
  Footer,
} from "../marketing-v3/shared/sections";
import { ResultsLedger } from "../marketing-v3/shared/signature";
import { MechanismPinnedV4 } from "./mechanism/MechanismPinnedV4";
import { EvidenceLockerV4 } from "./evidence/EvidenceLockerV4";
import { TestimonialsSectionV4 } from "./testimonials/TestimonialsSectionV4";
import { HowItWorksSectionV4 } from "./howitworks/HowItWorksSectionV4";
import { TrustStripSection } from "./truststrip/TrustStripSection";
import { PainMirrorV4 } from "./pain/PainMirrorV4";
import { ReframeGatherV4 } from "./reframe/ReframeGatherV4";
import { MeetVanceV4 } from "./meetvance/MeetVanceV4";

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
      <PainMirrorV4 />
      <ReframeGatherV4 />
      <MeetVanceV4 />
      <MechanismPinnedV4 />
      <EvidenceLockerV4 />
      <ResultsLedger />
      <TestimonialsSectionV4 />
      <HowItWorksSectionV4 />
      <Faq />
      <RiskReversal />
      <Urgency />
      <RegisterSection />
      <Footer />
      <Intro label={site.ev.kickers.hero} />
    </>
  );
}
