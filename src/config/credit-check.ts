export const CREDIT_REPORT_COMPANIES = [
  "Midland Credit Management",
  "Portfolio Recovery Associates",
  "LVNV Funding LLC (aka Resurgent Receivable LLC)",
  "Jefferson Capital LLC",
  "National Credit Adjusters",
  "Spring Oaks Capital LLC",
  "Plaza Services LLC",
  "CK Prime Investment LLC",
  "NCB Management Services",
  "Credit Corp Solutions Inc",
  "RD Case & Associates",
  "Bounce AI, Inc",
  "Absolute Resolutions",
  "Zion Debt Holdings",
  "Credit One, LLC",
  "True Accord",
] as const;

export const CREDIT_CHECK_UNKNOWN_OPTION = "I’m not sure yet—I need to check my reports";

export const CREDIT_CHECK_QUESTIONS = [{
  id: "companies",
  title: "Which companies are on your credit reports?",
  type: "multi" as const,
  options: [...CREDIT_REPORT_COMPANIES, CREDIT_CHECK_UNKNOWN_OPTION],
}];

// Original guide supplied by Vance; PDF links use physical page numbers.
export const CREDIT_CHECK_GUIDE = {
  title: "How to get all three credit reports",
  href: "/guides/annual-credit-report-guide-vance-dotson.pdf",
  pages: 42,
};
