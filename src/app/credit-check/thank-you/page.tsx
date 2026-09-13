import type { Metadata } from "next";
import { CreditReportGuide } from "@/components/credit-check/CreditReportGuide";

export const metadata: Metadata = {
  title: "Get your credit reports to Vance | 2 simple steps",
  robots: { index: false, follow: false },
};

export default function CreditCheckThankYouPage() {
  return <CreditReportGuide />;
}
