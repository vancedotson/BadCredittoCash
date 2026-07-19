"use client";

import { site } from "@/config/site-v3";
import { HeaderV4 } from "./HeaderV4";
import { HeroV4 } from "./HeroV4";
import {
  Intro,
  Faq,
  Footer,
} from "../marketing-v3/shared/sections";
import { ResultsLedger } from "../marketing-v3/shared/signature";
import { MechanismPinnedV4 } from "./mechanism/MechanismPinnedV4";
import { EvidenceLockerV4 } from "./evidence/EvidenceLockerV4";
import { TestimonialsSectionV4 } from "./testimonials/TestimonialsSectionV4";
import { HowItWorksSectionV4 } from "./howitworks/HowItWorksSectionV4";
import { TrustStripSection } from "./truststrip/TrustStripSection";
import { PainMirrorV4 } from "./pain/PainMirrorV4";
import { CollectorQuizV4 } from "./quiz/CollectorQuizV4";
import { ReframeGatherV4, ReframeLawsV4 } from "./reframe/ReframeGatherV4";
import { MeetVanceV4 } from "./meetvance/MeetVanceV4";
import { RiskSectionV4 } from "./risk/RiskSectionV4";
import { UrgencySectionV4 } from "./urgency/UrgencySectionV4";
import { RegisterSectionV4 } from "./register/RegisterSectionV4";

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
      <CollectorQuizV4 />
      <ReframeGatherV4 />
      <MeetVanceV4 />
      <ReframeLawsV4 />
      <MechanismPinnedV4 />
      <EvidenceLockerV4 />
      <ResultsLedger />
      <TestimonialsSectionV4 />
      <HowItWorksSectionV4 />
      <RiskSectionV4 />
      {/* Sticky reveal: urgency pins full-height, holds through a transparent
          spacer (the dwell), then the register section scrolls up over it. */}
      <div className="v4-stack">
        <UrgencySectionV4 />
        <div className="v4-stack-spacer" aria-hidden />
        <RegisterSectionV4 />
      </div>
      <Faq />
      <Footer />
      <Intro label={site.ev.kickers.hero} />
    </>
  );
}
