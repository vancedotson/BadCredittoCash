import { QUIZ_QUESTIONS } from "./collector-quiz";

// A focused version of the home-page check; the original quiz stays intact.
const questionIds = ["how", "recognize", "report", "disputed", "urgency"];
export const CREDIT_CHECK_QUESTIONS = questionIds.map((id) => {
  const question = QUIZ_QUESTIONS.find((item) => item.id === id);
  if (!question) throw new Error(`Missing credit-check question: ${id}`);
  return question;
});

// Original guide supplied by Vance; PDF links use physical page numbers.
export const CREDIT_CHECK_GUIDE = {
  title: "How to get all three credit reports",
  href: "/guides/annual-credit-report-guide-vance-dotson.pdf",
  pages: 42,
};
