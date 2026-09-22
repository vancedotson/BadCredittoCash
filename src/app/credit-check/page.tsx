import { CreditCheckQuiz } from "@/components/credit-check/CreditCheckQuiz";
import { isCreditCheckLocalMode } from "@/lib/credit-check";
import { creditCheckPageMetadata } from "@/lib/route-metadata";

export const metadata = creditCheckPageMetadata;

export default function CreditCheckPage() {
  return <CreditCheckQuiz localMode={isCreditCheckLocalMode()} />;
}
