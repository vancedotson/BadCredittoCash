import { Header } from "@/components/marketing/Header";
import { HeroCinematic } from "@/components/marketing/hero/HeroCinematic";
import { PainSplit } from "@/components/marketing/painmirror/PainSplit";
import { Reframe } from "@/components/marketing/reframe/Reframe";
import { ReframeZigzag } from "@/components/marketing/reframe/ReframeZigzag";
import { MeetDossier } from "@/components/marketing/meetvance/MeetDossier";
import { HorizRail } from "@/components/marketing/mechanism/HorizRail";
import { ProofLibrary } from "@/components/marketing/proofcalls/ProofLibrary";
import { ResultsBoldLedger } from "@/components/marketing/proofresults/ResultsBoldLedger";
import { TestiMarquee } from "@/components/marketing/testimonials/TestiMarquee";
import { StepsPoster } from "@/components/marketing/howitworks/StepsPoster";
import { FaqAccordion } from "@/components/marketing/faq/FaqAccordion";
import { RiskStatement } from "@/components/marketing/riskreversal/RiskStatement";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Footer } from "@/components/marketing/Footer";
import { StickyCta } from "@/components/marketing/StickyCta";
import { CollectorQuiz } from "@/components/marketing/quiz/CollectorQuiz";

/**
 * /v1spare — the original v1 marketing home page, kept as a spare after the v4
 * "Case File" experience became the main home (/). Same narrative arc; still
 * fully functional.
 */
export default function V1Spare() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <HeroCinematic />
        <PainSplit />
        <CollectorQuiz />
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
