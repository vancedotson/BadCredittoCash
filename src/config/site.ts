/**
 * Content config — Vance Dotson / "Bad Credit to Cash" sales page.
 *
 * ALL page copy lives here so voice stays consistent and compliant.
 * Sources: sales-page-structure.md (layout), brand-voice-style-guide.md (voice),
 * target-audience-avatar.md (audience), offer-detailed.md (offer).
 *
 * ⚠️  = MUST be confirmed by Vance / legal review before going live. These are
 *       written in the compliance-SAFE framing already, but flagged so nothing
 *       stronger (or unverified) ships by accident. Key open items:
 *       - Attorney status (affects "hold accountable" / mechanism wording)
 *       - Guarantee wording (50% vs 100% contradiction — do NOT publish a % yet)
 *       - Pricing (never on this page — call/webinar only)
 *       - Real phone, office address, licensing, and media assets (photo, calls,
 *         testimonials, results) are PLACEHOLDERS until provided.
 */

export const site = {
  name: "Vance Dotson",

  seo: {
    title: "Vance Dotson — Stop the collector calls. Hold them accountable.",
    description:
      "A veteran consumer advocate who uses federal law (FCRA & FDCPA) to challenge inaccurate credit reporting and stop debt-collector harassment. Watch how it works — free.",
  },

  // ⚠️ PLACEHOLDER — replace with Vance's real number and address.
  contact: {
    phoneDisplay: "(405) 555-0123",
    phoneHref: "tel:+14055550123",
    email: "help@vancedotson.com",
    officeCity: "Oklahoma City, OK",
    officeAddress: "123 Example St, Oklahoma City, OK 73102",
  },

  // Dual CTA carried throughout (see structure: webinar primary, call secondary).
  cta: {
    primary: { label: "Watch How It Works — Free", href: "#register" },
    secondary: { label: "Book a Free Strategy Call", href: "#register" },
  },

  // Anchor nav links (targets: ids on the corresponding sections).
  nav: [
    { label: "How It Works", href: "#how" },
    { label: "Proof", href: "#proof" },
    { label: "FAQ", href: "#faq" },
  ],

  // Announcement bar — pushes DIY-inclined visitors to watch first.
  // Scarcity is HONEST capacity only (voice/brand: no fake countdowns, no "3 spots left").
  announcement: {
    message:
      "Thinking of disputing it yourself? That's exactly what didn't work last time.",
    messageShort: "About to dispute it yourself?",
    ctaLabel: "See what actually works — free",
    scarcity: "It's just me, so spots are limited.",
    href: "#register",
  },

  // Small icon+label trust row (hero, mid-page, close). ⚠️ licensing must match
  // Vance's confirmation — it's a credit-services registration, not a bar license.
  trustBar: [
    "Advocate since 2004",
    "Real cases on tape",
    // ⚠️ NEEDS CONFIRMATION (credit-services registration, not a bar license)
    "Licensed & bonded (OK)",
    "Real OKC office",
  ],

  // SECTION 1 — Hero
  hero: {
    // ⚠️ the "owe you" reframe is tied to "where the law allows".
    headline: "The calls stop. And you find out if they owe you.",
    subhead:
      "I'm Vance. Since 2004 I've gone after the bureaus and collectors who break the law — using the FCRA and FDCPA to challenge the inaccurate information wrecking your credit. Not weak letters. Real action.",
    photoCaption: "Vance Dotson — at his Oklahoma City office",
    // ⚠️ PLACEHOLDER — real aggregate proof (swap in Vance's true numbers).
    rating: { stars: "4.9", count: "500+ Oklahomans helped ⚠️" },
  },

  // SECTION 2 — Pain Mirror
  painMirror: {
    heading: "Sound familiar?",
    points: [
      "Your phone buzzes — and your stomach drops before you even look.",
      "They've called your job. Your family. At dinner.",
      "There's stuff on your report that isn't even yours — and it won't come off.",
      "You disputed it. It came back.",
      'You paid a "credit repair" company and got… nothing.',
    ],
    pivot: "You're not the problem. Keep reading.",
  },

  // SECTION 3 — The Reframe
  reframe: {
    kicker: "Here's what nobody told you:",
    headline: "The law is already on your side.",
    body: "The FCRA and FDCPA exist to protect you. When the bureaus report wrong information, or collectors harass you, they're the ones breaking the rules. Most people just never knew they could push back.",
    note: "Most people just never knew they could push back.",
    laws: [
      {
        abbr: "FCRA",
        name: "Fair Credit Reporting Act",
        desc: "When the bureaus report wrong information about you, they're the ones breaking the rules.",
      },
      {
        abbr: "FDCPA",
        name: "Fair Debt Collection Practices Act",
        desc: "When collectors harass you, they're crossing a line the law drew to protect you.",
      },
    ],
    // Zig-zag education rows (voice: plain, name the enemy, first-person, dignity-first).
    zigzagHeading: "Here's what that actually means for you.",
    zigzag: [
      {
        title: "The bureaus have to get it right — by law.",
        body: "When TransUnion, Equifax, or Experian put wrong information on your report, that's not just annoying. It's against the law. The FCRA says they have to report the truth. When they don't, they broke the rules — not you.",
        imageHint: "A credit report with an inaccurate item circled",
      },
      {
        title: "Collectors can't just do whatever they want.",
        body: "Calling your job. Calling your family. Calling at dinner, over and over. A lot of that isn't just rude — it's illegal. The FDCPA drew a hard line, and collectors cross it every day.",
        imageHint: "A phone showing repeated calls from a collector",
      },
      {
        title: "You could push back this whole time.",
        body: "Here's the part nobody says out loud: these laws already exist to protect you. No loophole. No trick. You just needed someone who knows how to use them — the way I have since 2004.",
        imageHint: "Vance at his OKC office, reviewing a client's file",
      },
    ],
  },

  // SECTION 4 — Meet Vance
  meetVance: {
    heading: "I'm Vance Dotson.",
    // ⚠️ mechanism/attorney wording — kept to the safe "challenge / hold accountable" framing.
    body: [
      "I've been a consumer advocate since 2004. I've spoken at national consumer-advocate conferences. I know the FCRA and FDCPA cold — and I use them to go after the bureaus and collectors who think the rules don't apply to them.",
      "I'm not a call center. I'm a real person, with a real office, who takes this personally.",
    ],
    signoff: "Real person. Real office. Real cases.",
    stats: [
      { value: "20+", label: "years — since 2004" },
      { value: "FCRA + FDCPA", label: "the laws I use" },
      { value: "OKC", label: "a real office, not a call center" },
    ],
    // ⚠️ the licensing line needs Vance's confirmation before it ships.
    credentials: [
      "Consumer advocate since 2004",
      "Spoken at national consumer-advocate conferences",
      "Licensed & bonded in Oklahoma",
      "A real office in Oklahoma City",
    ],
  },

  // SECTION 5 — The Mechanism
  mechanism: {
    eyebrow: "Why this is different",
    subhead:
      "No form letters. No crossing your fingers. Just a real process, grounded in the law — start to finish.",
    heading: "Most “credit repair” mails letters and hopes. Here's what I do instead:",
    steps: [
      {
        title: "Find the violations",
        body: "I review your reports and the collector activity for what's inaccurate, incomplete, or against the law.",
      },
      {
        // ⚠️ exact wording depends on attorney status.
        title: "Hold them accountable under the law",
        body: "I don't stop at a letter. I treat inaccurate reporting and collector misconduct as what they are — violations of federal law.",
      },
      {
        // ⚠️ compensation tied to "where the law allows".
        title: "Push for results — and compensation where the law allows",
        body: "We challenge the inaccurate items and, where the law allows, pursue the compensation you may be owed.",
      },
    ],
    kicker: "Anyone can send a letter. Knowing the law is the difference.",
  },

  // SECTION 6 — Proof I: Recorded calls (⚠️ real media assets needed)
  proofCalls: {
    heading: "Don't take my word for it. Listen to them get caught.",
    subhead: "Real calls. Real violations.",
    // ⚠️ PLACEHOLDER clips — swap in real captioned audio/video.
    clips: [
      { title: "Collector vs. Vance — FDCPA violation", duration: "2:14" },
      { title: "Collector vs. Vance — FCRA violation", duration: "1:47" },
      { title: "Collector admits it on the call", duration: "3:02" },
      // ⚠️ PLACEHOLDER — additional library entries; swap in real captioned media.
      { title: "Third-party disclosure — FDCPA violation", duration: "1:58" },
      { title: "Contact after written dispute — FCRA violation", duration: "2:33" },
      { title: "Pre-dawn call — FDCPA violation", duration: "0:52" },
    ],
  },

  // SECTION 7 — Proof II: Results (⚠️ documented results from prior site; re-captioned as plain text)
  proofResults: {
    heading: "What that looks like in real life:",
    // ⚠️ Confirm each with Vance; keep the disclaimer visible in the same viewport.
    // Re-captioned from documented outcomes — { item challenged, outcome }.
    results: [
      { item: "Bankruptcy + 2 medical collections", outcome: "Removed" },
      { item: "3 student loans", outcome: "Removed" },
      { item: "Foreclosure, repo, judgment & charge-offs", outcome: "Removed" },
      { item: "8 collection accounts", outcome: "Removed" },
      { item: "Foreclosure", outcome: "Paid as agreed" },
    ],
    disclaimer:
      "Results vary and are not guaranteed. Past outcomes don't promise future results. Every case is different.",
  },

  // SECTION 8 — Proof III: Testimonials (⚠️ real video + names needed)
  testimonials: {
    heading: "In their own words:",
    items: [
      { quote: "They stopped calling within a week.", name: "Client, OKC ⚠️" },
      { quote: "I didn't think it was real. It was.", name: "Client, OKC ⚠️" },
      // ⚠️ PLACEHOLDER — swap in real quotes + names/permission.
      { quote: "For the first time in years, I could breathe.", name: "Client, OKC ⚠️" },
      { quote: "The calls stopped. So did the stress.", name: "Client, OKC ⚠️" },
    ],
  },

  // SECTION 9 — How It Works
  howItWorks: {
    heading: "Getting started is simple:",
    steps: [
      { title: "Book a free call (or watch first)", body: "No cost, no obligation." },
      { title: "We review your case and find the violations", body: "You'll know exactly where you stand." },
      { title: "We go to work — you take back control", body: "I handle the bureaus and collectors so you don't have to." },
    ],
  },

  // SECTION 10 — Objection Crusher (order: scam → legal → different → cost → judgment)
  faq: [
    {
      q: "Is this a scam?",
      a: "Fair question — you've probably been burned before. I'm a real, named advocate who's been doing this since 2004, out of a real office in Oklahoma City. You don't have to trust me. Trust the recorded calls and the results.",
    },
    {
      q: "Is this even legal?",
      a: "It's the opposite of a trick. It's enforcing the federal laws — the FCRA and FDCPA — that already exist to protect you. Most people just never knew they could push back.",
    },
    {
      q: "How is this different from what I already tried?",
      // ⚠️ mechanism wording.
      a: "DIY disputes and cheap credit-repair mills send letters and hope. When the bureaus stamp it “verified,” they stop. I don't. I hold them accountable under the law for what's inaccurate and for how they've treated you.",
    },
    {
      q: "What will it cost me?",
      a: "The strategy call is free. Its whole job is to see whether you even have a case — before you commit to anything.",
    },
    {
      q: "Will I be judged?",
      a: "Never. I've seen it all and none of it surprises me. You're not the problem here — the system broke its own rules.",
    },
  ],

  // SECTION 11 — Risk Reversal (⚠️ money-back guarantee NOT included until reconciled + legal review)
  riskReversal: {
    heading: "You've got nothing to lose by looking.",
    points: [
      "The strategy call is free.",
      "No judgment — I've seen it all.",
      "No obligation.",
      "Worst case: you learn exactly where you stand.",
    ],
    // ⚠️ Do NOT publish a money-back percentage (50% vs 100% contradiction) until
    //    Vance picks one and a CROA-competent attorney signs off.
    guaranteeNote: "",
  },

  // SECTION 12 — Honest Urgency (NO fake countdowns)
  urgency: {
    heading: "Every day you wait:",
    points: [
      "The calls keep coming.",
      "The wrong information keeps hurting your score and your approvals.",
      "Some legal claims are time-sensitive. ⚠️",
    ],
    scarcity: "Slots are limited — it's just me.",
  },

  // SECTION 13 — Final CTA
  finalCta: {
    heading: "You've been carrying this alone. You don't have to anymore.",
  },

  // Registration / booking section (serves the dual CTA)
  register: {
    heading: "Save your seat — or talk to me now.",
    body: "Watch the free training to see exactly how this works, or if the calls won't stop and you want help today, reach out directly.",
    // ⚠️ webinar date is a placeholder.
    webinarNote: "Free online training · watch on any device",
  },

  // FOOTER (compliance-critical)
  footer: {
    // ⚠️ every disclosure below needs legal/CROA review and must match Vance's confirmations.
    disclaimers: [
      "Results vary and are not guaranteed. Individual outcomes depend on the specifics of your situation.",
      "Vance Dotson is a consumer advocate. This website is for general information and is not legal advice. ⚠️",
      "Licensed & bonded for credit services in Oklahoma. ⚠️",
    ],
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Contact", href: "#register" },
    ],
  },
} as const;

export type Site = typeof site;
