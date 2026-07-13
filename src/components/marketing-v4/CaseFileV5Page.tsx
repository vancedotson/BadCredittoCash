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
import { ReframeGatherV4, ReframeLawsV4 } from "./reframe/ReframeGatherV4";
import { MeetVanceV4 } from "./meetvance/MeetVanceV4";
import { RiskV3 } from "./risk/RiskV3";
import { UrgencySectionV4 } from "./urgency/UrgencySectionV4";
import { RegisterSectionV4 } from "./register/RegisterSectionV4";

/**
 * /v5 — the Case File design as a dark/light DUOTONE. The page runs LIGHT
 * (warm paper) by default; only five sections stay DARK as anchors: the hero,
 * "meet the advocate", "in their own words" (testimonials), "open your case"
 * (register), and the footer. Light is applied via `.v5-light` wrappers; the
 * decorative dark imagery in the flipped sections is suppressed in that scope
 * (see v3.css). The urgency->register sticky reveal keeps working: the stack is
 * light (urgency) with the register wrapped back to `.v5-dark`. Edited only here.
 */
export function CaseFileV5Page() {
  return (
    <>
      <span id="top" />
      <HeaderV4 />
      <HeroV4 />

      <div className="v5-light">
        <TrustStripSection />
        <PainMirrorV4 />
        <ReframeGatherV4 />
      </div>

      <MeetVanceV4 />

      <div className="v5-light">
        <ReframeLawsV4 />
        <MechanismPinnedV4 />
        <EvidenceLockerV4 />
        <ResultsLedger />
      </div>

      <TestimonialsSectionV4 />

      <div className="v5-light">
        <HowItWorksSectionV4 />
        <RiskV3 />
      </div>

      {/* Sticky reveal: urgency (light) pins full-height, holds through a
          transparent spacer, then the register section (dark) scrolls over it. */}
      <div className="v4-stack v5-light">
        <UrgencySectionV4 />
        <div className="v4-stack-spacer" aria-hidden />
        <div className="v5-dark">
          <RegisterSectionV4 />
        </div>
      </div>

      <div className="v5-light">
        <Faq />
      </div>

      <Footer />
      <Intro label={site.ev.kickers.hero} />
    </>
  );
}
