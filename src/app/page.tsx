import { Header } from "@/components/marketing/Header";
import { HeroCinematic } from "@/components/marketing/hero/HeroCinematic";
import { PainSplit } from "@/components/marketing/painmirror/PainSplit";
import { Reframe } from "@/components/marketing/reframe/Reframe";
import { ReframeZigzag } from "@/components/marketing/reframe/ReframeZigzag";
import { MeetDossier } from "@/components/marketing/meetvance/MeetDossier";
import { HorizRail } from "@/components/marketing/mechanism/HorizRail";
import { ProofDiscLibrary } from "@/components/marketing/proofcalls/ProofDiscLibrary";
import { ProofResults } from "@/components/marketing/ProofResults";
import { Testimonials } from "@/components/marketing/Testimonials";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { ObjectionCrusher } from "@/components/marketing/ObjectionCrusher";
import { RiskReversal } from "@/components/marketing/RiskReversal";
import { HonestUrgency } from "@/components/marketing/HonestUrgency";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Footer } from "@/components/marketing/Footer";
import { StickyCta } from "@/components/marketing/StickyCta";

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
        <Reframe />
        <ReframeZigzag />
        <MeetDossier />
        <HorizRail />
        <ProofDiscLibrary />
        <ProofResults />
        <Testimonials />
        <HowItWorks />
        <ObjectionCrusher />
        <RiskReversal />
        <HonestUrgency />
        <FinalCta />
      </main>
      <Footer />
      <StickyCta />
    </>
  );
}
