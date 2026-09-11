import type { Metadata } from "next";
import { CreditCheckQuiz } from "@/components/credit-check/CreditCheckQuiz";
import { isCreditCheckLocalMode } from "@/lib/credit-check";

export const metadata: Metadata = {
  title: "Check the companies on your credit report",
  description: "Select the companies you recognize, share your contact details, and get the simple guide for pulling your three credit reports.",
};

export default function CreditCheckPage() {
  return <CreditCheckQuiz localMode={isCreditCheckLocalMode()} />;
}
