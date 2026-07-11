import { Header } from "@/components/marketing-v2/Header";
import { HeroCinematic } from "@/components/marketing-v2/hero/HeroCinematic";
import { PainSplit } from "@/components/marketing-v2/painmirror/PainSplit";
import { Reframe } from "@/components/marketing-v2/reframe/Reframe";
import { ReframeZigzag } from "@/components/marketing-v2/reframe/ReframeZigzag";
import { MeetDossier } from "@/components/marketing-v2/meetvance/MeetDossier";
import { HorizRail } from "@/components/marketing-v2/mechanism/HorizRail";
import { ProofLibrary } from "@/components/marketing-v2/proofcalls/ProofLibrary";
import { ResultsBoldLedger } from "@/components/marketing-v2/proofresults/ResultsBoldLedger";
import { TestiMarquee } from "@/components/marketing-v2/testimonials/TestiMarquee";
import { StepsPoster } from "@/components/marketing-v2/howitworks/StepsPoster";
import { FaqAccordion } from "@/components/marketing-v2/faq/FaqAccordion";
import { RiskStatement } from "@/components/marketing-v2/riskreversal/RiskStatement";
import { FinalCta } from "@/components/marketing-v2/FinalCta";
import { Footer } from "@/components/marketing-v2/Footer";
import { StickyCta } from "@/components/marketing-v2/StickyCta";
import { TrustBar } from "@/components/marketing-v2/TrustBar";

/**
 * v2 — an isolated clone of the home page. Every section renders from the
 * `marketing-v2` component tree, so edits here never touch the live page (/).
 * Shared: the root layout (fonts/theme), site config, and lib helpers.
 */
export default function HomeV2() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <HeroCinematic />
        {/* Trust strip — honest credibility signals right under the hero. */}
        <div className="border-b border-mist bg-cloud">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <TrustBar variant="light" className="justify-center" />
          </div>
        </div>
        <PainSplit />
        <Reframe />
        <ReframeZigzag />
        <MeetDossier />
        <HorizRail />
        <ProofLibrary />
        <ResultsBoldLedger />
        <TestiMarquee />
        <StepsPoster />
        <FaqAccordion />
        <RiskStatement />
        <FinalCta />
      </main>
      <Footer />
      <StickyCta />
    </>
  );
}
