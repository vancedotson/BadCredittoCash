/**
 * Shared content + logic for the "60-second collector check" quiz, used by both
 * the light home-page skin (marketing/quiz/CollectorQuiz) and the dark case-file
 * skin (marketing-v4/quiz/CollectorQuizV4). Compliance-safe: every question is
 * about the visitor's OWN experience; nothing asserts a company broke the law.
 */

export const COLLECTORS = [
  "Midland Credit Management",
  "Portfolio Recovery Associates",
  "LVNV Funding / Resurgent",
  "Jefferson Capital",
  "National Credit Adjusters",
  "Spring Oaks Capital",
  "Plaza Services",
  "CKS Prime Investments",
  "NCB Management Services",
  "Credit Corp Solutions",
  "RD Case & Associates",
  "Bounce AI",
  "Absolute Resolutions",
  "Zion Debt Holdings",
  "Credit One",
  "TrueAccord",
];

export type QuizQuestion = { id: string; title: string; type: "single" | "multi"; options: string[] };

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: "who", title: "Recognize any of these? Select whoever has been contacting you.", type: "multi", options: [...COLLECTORS, "Someone else", "I'm not sure of the name"] },
  { id: "how", title: "How are they reaching you?", type: "multi", options: ["Phone calls", "Voicemails", "Letters in the mail", "Text messages", "Emails", "Showing on my credit report"] },
  { id: "frequency", title: "How often do the calls come?", type: "single", options: ["Multiple times a day", "A few times a week", "Now and then", "It feels constant"] },
  { id: "timing", title: "When do they usually call?", type: "single", options: ["Early morning or late at night", "While I'm at work", "At all hours", "Normal hours"] },
  { id: "thirdparty", title: "Have they contacted anyone else about your debt?", type: "single", options: ["Yes, family or coworkers", "Not that I know of", "I'm not sure"] },
  { id: "recognize", title: "Do you recognize this debt as yours?", type: "single", options: ["Yes, it's mine", "No, it isn't", "It's old, or I thought it was gone", "I'm not sure"] },
  { id: "report", title: "Is it showing up on your credit report?", type: "single", options: ["Yes", "Yes, more than once", "Haven't checked", "No"] },
  { id: "disputed", title: "Have you disputed it?", type: "single", options: ["Yes, and it came back", "Yes, still waiting", "No", "I didn't know I could"] },
  { id: "afterstop", title: "Have they kept contacting you after you asked them to stop?", type: "single", options: ["Yes", "No", "I haven't asked them to stop"] },
  { id: "threats", title: "Have they threatened you in any way?", type: "single", options: ["Yes, legal action or arrest", "Aggressive or rude", "No", "Not sure if it counts"] },
  { id: "impact", title: "How is this affecting you?", type: "multi", options: ["Stress or lost sleep", "I avoid answering my phone", "It's hurting my credit", "It's affecting my family", "It's affecting my job"] },
  { id: "urgency", title: "How soon would you want this handled?", type: "single", options: ["As soon as possible", "Within a month", "Just exploring my options"] },
];

export const QUIZ_TOTAL = QUIZ_QUESTIONS.length;

export type QuizAnswers = Record<string, string | string[]>;

/** Observation-only reflections for the results screen (never a legal conclusion). */
export function quizReflections(answers: QuizAnswers): string[] {
  const who = Array.isArray(answers.who) ? answers.who : [];
  const namedCount = who.filter((w) => w !== "Someone else" && w !== "I'm not sure of the name").length;
  const out: string[] = [];
  if (namedCount > 0) out.push(`You named ${namedCount} collector${namedCount === 1 ? "" : "s"} that ${namedCount === 1 ? "has" : "have"} been contacting you.`);
  if (answers.afterstop === "Yes") out.push("They have kept reaching out even after being asked to stop.");
  if (answers.recognize === "No, it isn't" || answers.recognize === "It's old, or I thought it was gone") out.push("You are not even sure this debt is really yours.");
  if (answers.timing === "Early morning or late at night" || answers.timing === "At all hours") out.push("The calls are coming at hours that may cross a line.");
  return out;
}
