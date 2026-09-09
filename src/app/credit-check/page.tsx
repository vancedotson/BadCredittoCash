import type { Metadata } from "next";
import { CreditCheckQuiz } from "@/components/credit-check/CreditCheckQuiz";
import { isCreditCheckLocalMode } from "@/lib/credit-check";

export const metadata: Metadata = {
  title: "Your 60-second credit check",
  description: "Collector calls or credit report problems? Answer five quick questions and get your next step with Vance Dotson.",
};

export default function CreditCheckPage() {
  return <CreditCheckQuiz localMode={isCreditCheckLocalMode()} />;
}
