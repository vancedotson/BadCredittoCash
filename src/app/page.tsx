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
 * Narrative arc (sales-page-structure.md):
 * I see you (pain) -> it's not your fault (reframe) -> a real person who fights
 * this (Vance) -> here's how it's different (mechanism) -> proof (calls/results/
 * testimonials) -> your simple safe step (how it works) -> fears handled
 * (objections) -> no risk (reversal) -> why now (urgency) -> take back control.
 */
export default function Home() {
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
