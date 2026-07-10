# Sales Page Structure & Wireframe — Vance Dotson / Bad Credit to Cash

**Prepared for:** Sales page build (dual conversion)
**Companions:** `target-audience-avatar.md`, `offer-detailed.md`, `brand-voice-style-guide.md`
**Two goals of this page:**
1. **Primary CTA:** Register for / watch the free webinar ("How It Works")
2. **Secondary CTA:** Book a free strategy call

> **Compliance guardrails (safe mode):** anchors to *inaccurate/incomplete information* and *holding bureaus & collectors accountable under federal law*; never guaranteed deletions/scores; no implied personal legal representation unless attorney status is confirmed. ⚠️ marks anything that gets stronger — or must be corrected — once Vance confirms mechanism/attorney status, guarantee wording, and pricing.
> **Design system note:** full palette, type scale, and tokens live in the forthcoming **brand guideline file**. This doc defines *per-section UI/UX intent* and layout — not the global design system.

---

## Dual-CTA funnel logic (read first — it drives the whole page)

The two goals aren't equal; they're **sequential by temperature**:

- **Cold / skeptical traffic (most of Facebook)** → push the **webinar** first. It's lower-commitment, it's educational, and it does the heavy lifting of dissolving the "scam / is-it-legal / already-tried-it" objections *before* asking for a call. The webinar's own closing CTA is then "book a call."
- **Warm / high-intent traffic (they're being harassed *right now*)** → let them **book a call** immediately without forcing the webinar.

**So the page carries both CTAs throughout, styled with clear hierarchy:** webinar = primary (biggest, boldest button), book-a-call = secondary (present, always available, slightly lighter). Never make a ready-to-buy person sit through a webinar to reach you, and never dump a cold skeptic straight onto a booking calendar with no trust built.

---

## Global UX principles

- **Mobile-first, non-negotiable.** The avatar (Denise) is on Facebook on her phone, late at night. Design for the 375px viewport first; desktop is the upscale.
- **Sticky CTA bar** on scroll (mobile + desktop) so the conversion action is always one tap away.
- **Proof is load-bearing, not decorative.** For a burned audience, the recorded calls / results / real-person elements aren't "nice to have" — they're the conversion engine. Give them room.
- **Fast + light.** Skeptical, lower-income users on mobile data. Compress everything; lazy-load video. Slow = distrust.
- **One idea per screen.** Short sections, generous white space, big tap targets, high contrast.
- **Accessibility = trust here.** Legible type (16px+ body), strong contrast, captions on all video (many watch muted on FB).

## Global design direction (holding pattern until the brand guide)

- **Feel:** credible, solid, human, *the opposite of scammy.* Think "trusted professional who's on your side," not "get-rich guru." Restraint signals legitimacy to this audience.
- **Color intent:** deep, trustworthy base (navy/blue = law, stability, authority) + one confident action accent for CTAs (a strong gold/amber or green = go/value). **Avoid** alarm-red, neon, and high-hype gradients — they read as scam.
- **Imagery:** real photos of Vance and his office > stock. Authenticity is the whole game. Faces of relatable real people for testimonials.
- **Type:** clean, sturdy, readable. A confident sans for headlines, a highly legible sans for body. No thin/fragile fonts.

---

## THE SECTION-BY-SECTION BLUEPRINT

Each section below gives: **wireframe · name · goal · UI/UX styles · cognitive biases · why it matters for the avatar.**

---

### SECTION 1 — Hero / Above the Fold

```
┌─────────────────────────────────────────┐
│  [logo]                    [Book a Call] │  ← nav, secondary CTA top-right
│                                          │
│   THE CALLS STOP. AND YOU FIND OUT       │  ← H1 (pain + reframe)
│   IF THEY OWE YOU. ⚠️                     │
│                                          │
│   Sub: I'm Vance. Since 2004 I've gone   │  ← subhead: person + mechanism
│   after the bureaus & collectors who     │
│   break the law. Not letters. Action. ⚠️ │
│                                          │
│   [ ▶ WATCH: HOW IT WORKS (FREE) ]        │  ← PRIMARY CTA (webinar)
│   [   Book a free strategy call   ]      │  ← secondary CTA
│                                          │
│   ✓ Advocate since 2004  ✓ Real cases    │  ← trust bar
│   ✓ Licensed & bonded (OK) ✓ On tape     │
│                                          │
│        [ photo of Vance — real ]         │
└─────────────────────────────────────────┘
```
- **Name:** Hero
- **Goal:** In 5 seconds, land the emotional hook + establish this is a real person + drive to the primary CTA (webinar), with book-a-call available.
- **UI/UX:** Full-viewport on mobile. H1 huge and short. Primary CTA button in the action accent, unmissable; secondary CTA as outline/ghost button beneath. Real photo of Vance (not stock) to kill the scam-suspicion instantly. Trust bar as small icon+label row. Sticky mini-CTA appears on scroll.
- **Cognitive biases:** **Framing effect** (the "they may owe *you*" reframe flips debtor-shame to righteous hope) · **Authority bias** ("since 2004," licensed) · **Von Restorff/isolation effect** (one dominant primary button) · **Liking** (real face).
- **Why it matters for the avatar:** She's arrived skeptical and hurting. The hero must instantly say *this is real, this person is on my side, and there's a bigger idea here than "fix my credit."* The reframe is the pattern-interrupt that stops the scroll.

---

### SECTION 2 — Pain Mirror ("Sound Familiar?")

```
┌─────────────────────────────────────────┐
│        Sound familiar?                   │
│                                          │
│  • Your phone buzzes — stomach drops     │
│  • They called your job. Your family.    │
│  • Stuff on your report that isn't       │
│    even yours — and won't come off       │
│  • You disputed it. It came back.        │
│  • You paid a "credit repair" company    │
│    and got… nothing                      │
│                                          │
│   You're not the problem. Keep reading.  │  ← pivot line (no wallowing)
└─────────────────────────────────────────┘
```
- **Name:** Pain Mirror
- **Goal:** Make the reader feel *seen* — "this is written about me" — then immediately pivot to agency.
- **UI/UX:** Short, scannable list in their own words (voice guide §8). Calm background, not alarming. End on the bolded pivot line so the section never leaves them in despair. Minimal, lots of breathing room.
- **Cognitive biases:** **Self-referential effect** (we mirror their exact inner monologue) · **In-group identity** (these are *her* specifics) · **Frequency/recognition** ("yes, that's me" builds momentum toward the yes).
- **Why it matters for the avatar:** Trust starts with feeling understood. She's been judged and dismissed; being *accurately described* — including the failed prior attempts — signals Vance actually gets it. The "you're not the problem" pivot pre-empts her shame.

---

### SECTION 3 — The Reframe / "It's Not Your Fault — They Broke the Rules"

```
┌─────────────────────────────────────────┐
│   Here's what nobody told you:           │
│                                          │
│   The law is already on YOUR side.       │
│                                          │
│   The FCRA and FDCPA exist to protect    │
│   you. When the bureaus report wrong     │
│   info, or collectors harass you —       │
│   THEY'RE the ones breaking the rules.   │
│                                          │
│   Most people just never knew they       │
│   could push back. ⚠️                     │
└─────────────────────────────────────────┘
```
- **Name:** The Reframe
- **Goal:** Shift the emotional frame from "I'm a failure who owes money" to "I'm a person who's been wronged, and the law backs me." This is the psychological turn the whole page pivots on.
- **UI/UX:** More editorial/spacious. One strong idea, large type. Name the two laws plainly (FCRA/FDCPA) — precision signals expertise without jargon overload. Warm, empowering tone visually.
- **Cognitive biases:** **Framing/reframing** (debtor → wronged party) · **Ambiguity aversion reduction** (removes the "is this even legit/legal" fog early) · **Authority** (invoking real federal law).
- **Why it matters for the avatar:** Shame and "is it legal?" are her two biggest blockers. This section dissolves both at once and gives her *permission* to be angry and to act — the emotional fuel for booking.

---

### SECTION 4 — Meet Vance (The Real Person)

```
┌─────────────────────────────────────────┐
│  [ real photo: Vance at his OKC office ] │
│                                          │
│   I'm Vance Dotson.                      │
│                                          │
│   I've been a consumer advocate since    │
│   2004. I've spoken at national          │
│   consumer-advocate conferences. I know  │
│   the FCRA and FDCPA cold — and I use    │
│   them to go after the bureaus and       │
│   collectors who think the rules don't   │
│   apply to them. ⚠️                       │
│                                          │
│   Real person. Real office. Real cases.  │
└─────────────────────────────────────────┘
```
- **Name:** Meet Vance
- **Goal:** Convert the abstract "service" into a trustworthy *human*, the single strongest antidote to the faceless-scam category.
- **UI/UX:** Real, warm photography — Vance at his actual office, ideally looking at camera. First-person copy. Keep credentials specific and consistent ("since 2004"). Could include a short (30–60s) captioned intro video.
- **Cognitive biases:** **Authority bias** (longevity, conference speaker) · **Liking/similarity** (plain-spoken, relatable) · **Halo effect** (a credible, warm person makes the whole offer feel credible).
- **Why it matters for the avatar:** She's been burned by faceless mills. A named, findable, experienced human she can *see* is what separates "maybe legit" from "another scam." This is where trust becomes personal.

---

### SECTION 5 — The Mechanism / "Why This Is Different"

```
┌─────────────────────────────────────────┐
│   Most "credit repair" mails letters     │
│   and hopes. Here's what I do instead:   │
│                                          │
│   [ simple 3-step visual of the process ]│  ← consumer version of litigation map
│    1. Find the violations                │
│    2. Hold them accountable ⚠️            │
│    3. Push for results — & compensation  │
│       where the law allows ⚠️             │
│                                          │
│   Anyone can send a letter.              │
│   Knowing the law is the difference.     │
└─────────────────────────────────────────┘
```
- **Name:** The Mechanism / Differentiator
- **Goal:** Prove this is *genuinely different* from what already failed her — and make the difference feel concrete and credible, not magical.
- **UI/UX:** A clean, simplified consumer-friendly graphic derived from the litigation process map (NOT the dense original). Three steps, icons, plain labels. This is a great spot to tease the webinar: "See exactly how this works →."
- **Cognitive biases:** **Contrast effect** (weak letters vs real action) · **Concreteness effect** (a visible process feels true) · **Curiosity gap** (teasing "how" pulls toward the webinar).
- **Why it matters for the avatar:** Her core objection is "how is this different from what I already tried?" If this section doesn't answer it convincingly, nothing else converts. The visible mechanism turns "sounds too good to be true" into "oh, I see *how*."

---

### SECTION 6 — Proof I: Recorded Collector Calls (the killer asset)

```
┌─────────────────────────────────────────┐
│   Don't take my word for it.             │
│   Listen to them get caught.             │
│                                          │
│   [ ▶ Collector vs. Vance — FDCPA ]      │  ← audio/video players, captioned
│   [ ▶ Collector vs. Vance — FCRA  ]      │
│   [ ▶ ...                          ]      │
│                                          │
│   Real calls. Real violations.           │
└─────────────────────────────────────────┘
```
- **Name:** Proof — Recorded Calls
- **Goal:** Deliver undeniable, visceral proof of the differentiator — collectors breaking the law and Vance catching them.
- **UI/UX:** Prominent, easy players with captions/transcripts (muted-autoplay-friendly). Give this section real visual weight — it's the most differentiating asset on the page. Short clips > long recordings.
- **Cognitive biases:** **Social proof** · **Concreteness/vividness effect** (hearing it beats reading it) · **Authority** (mastery on display) · **Emotional transportation** (the David-vs-Goliath satisfaction).
- **Why it matters for the avatar:** She's been powerless against these collectors. *Hearing* one get caught is cathartic and instantly credible — it's proof no letter-mill could fake. This is likely the single highest-converting block on the page.

---

### SECTION 7 — Proof II: Results (Documented Outcomes)

```
┌─────────────────────────────────────────┐
│   What that looks like in real life:     │
│                                          │
│  ┌───────────┐ ┌───────────┐            │
│  │ Bankruptcy│ │ 3 student │            │
│  │ +2 medical│ │ loans     │  ...        │
│  │ challenged│ │ challenged│            │  ← plain-text captioned result cards
│  │ & removed │ │ & removed │            │
│  └───────────┘ └───────────┘            │
│                                          │
│   * Results vary. Not a guarantee.       │  ← disclaimer
└─────────────────────────────────────────┘
```
- **Name:** Proof — Results
- **Goal:** Show concrete, specific outcomes so the promise feels achievable *for her*.
- **UI/UX:** Card grid. **Re-caption the old site's image-based results as plain text** so skimmers (and search engines) can read them. Include the required results disclaimer visibly. Specificity is the point.
- **Cognitive biases:** **Social proof** · **Concreteness/specificity effect** (a named bankruptcy removal beats "great results") · **Achievability/perceived-likelihood** (she sees her own situation reflected).
- **Why it matters for the avatar:** "Does this work for people like me?" She needs to see her exact problems (medical debt, foreclosure, repo) among the wins. Vague claims read as hype; specific documented outcomes read as real.

---

### SECTION 8 — Proof III: Testimonials

```
┌─────────────────────────────────────────┐
│   In their own words:                    │
│                                          │
│   [ ▶ video ] "They stopped calling      │
│               within a week."            │  ← captioned quote pull-out
│   [ ▶ video ] "I didn't think it was     │
│               real. It was."             │
└─────────────────────────────────────────┘
```
- **Name:** Testimonials
- **Goal:** Let relatable real people vouch — peer proof that lowers her guard.
- **UI/UX:** Video testimonials with **text quote pull-outs captioned** (never rely on un-transcribed video). Show real, relatable faces (her demographic). Lead each with the one-line result.
- **Cognitive biases:** **Social proof** (peer, not authority) · **Similarity/liking** (people like her) · **Bandwagon** (others took the leap and won).
- **Why it matters for the avatar:** Authority proof (Vance) + peer proof (testimonials) cover two different trust needs. Seeing someone who looks and sounds like her say "I was skeptical too, and it worked" answers "is this for someone like me?"

---

### SECTION 9 — How It Works (The 3 Steps)

```
┌─────────────────────────────────────────┐
│   Getting started is simple:             │
│                                          │
│   1  Book a free call (or watch first)   │
│   2  We review your case & find the      │
│      violations                          │
│   3  We go to work — you take back       │
│      control ⚠️                           │
│                                          │
│   [ ▶ WATCH HOW IT WORKS ]  [Book a call]│  ← both CTAs
└─────────────────────────────────────────┘
```
- **Name:** How It Works
- **Goal:** Remove friction/uncertainty by making the path feel simple and safe; present both CTAs.
- **UI/UX:** Clean 3-step visual, numbered, icons. Emphasize step 1 is free and low-commitment. Repeat the dual CTA here with clear hierarchy.
- **Cognitive biases:** **Processing fluency** (simple = trustworthy & doable) · **Commitment & consistency** (a tiny first yes) · **Effort/friction reduction** (perceived-effort is a purchase barrier).
- **Why it matters for the avatar:** Overwhelm is real for her. A clear, tiny, safe first step ("just a free conversation") is what converts intention into action. Ambiguity about "what happens if I reach out" is a silent killer here.

---

### SECTION 10 — Objection Crusher / "Is This a Scam? Is This Legal?"

```
┌─────────────────────────────────────────┐
│   The questions everyone asks:           │
│                                          │
│   Q: Is this even legal?                 │
│   A: It's the opposite of a trick — it's │
│      enforcing laws that already protect │
│      you. ⚠️                              │
│                                          │
│   Q: How's this different from what I    │
│      already tried? …                     │
│   Q: What will it cost me? (Call's free) │
│   Q: Will I be judged? (Never.)          │
└─────────────────────────────────────────┘
```
- **Name:** Objection Crusher (FAQ)
- **Goal:** Directly dissolve the specific fears that stop the booking, in her order of priority.
- **UI/UX:** Accordion FAQ (scannable, doesn't wall-of-text). Lead with the biggest objections from the avatar: scam → legal → different → cost → judgment. Plain, confident, non-defensive answers (voice guide §12).
- **Cognitive biases:** **Ambiguity aversion reduction** · **Objection pre-emption** (naming the fear first builds trust) · **Authority** (calm, informed answers).
- **Why it matters for the avatar:** Her top two blockers are literally "is it a scam?" and "is it legal?". If the page doesn't answer them head-on and calmly, she leaves. Addressing them openly (rather than dodging) is itself a trust signal to a burned buyer.

---

### SECTION 11 — Risk Reversal ⚠️

```
┌─────────────────────────────────────────┐
│   You've got nothing to lose by looking. │
│                                          │
│   • The strategy call is FREE            │
│   • No judgment — I've seen it all       │
│   • No obligation                        │
│   • Worst case: you learn exactly where  │
│     you stand                            │
│                                          │
│   [ guarantee statement — TBD ⚠️ ]        │
└─────────────────────────────────────────┘
```
- **Name:** Risk Reversal
- **Goal:** Shrink the perceived risk of the first step to near-zero.
- **UI/UX:** Reassuring, warm block. Emphasize FREE + no judgment. ⚠️ **The money-back guarantee must be reconciled (50% vs 100%) and legally reviewed before it appears here** — until then use the naturally-true, safe framing: "free call, worst case you learn where you stand."
- **Cognitive biases:** **Loss aversion (neutralized)** — removing downside · **Endowment of certainty** · **Reciprocity** (free value given first).
- **Why it matters for the avatar:** She has little money and less trust, and she's been burned paying for "help." A genuinely risk-free first step is often the deciding factor between booking and bouncing.

---

### SECTION 12 — Honest Urgency

```
┌─────────────────────────────────────────┐
│   Every day you wait:                    │
│   • the calls keep coming                │
│   • the wrong info keeps hurting your    │
│     score & approvals                    │
│   • some legal claims are time-sensitive⚠│
│                                          │
│   Slots are limited — it's just me.      │  ← honest capacity scarcity
└─────────────────────────────────────────┘
```
- **Name:** Honest Urgency
- **Goal:** Convert "someday" into "today" using *real* urgency only.
- **UI/UX:** Calm, factual — **no fake countdown timers** (they scream scam to this audience). Frame urgency around ongoing harm + genuine capacity limits (one advocate).
- **Cognitive biases:** **Loss aversion / cost of inaction** · **Scarcity (genuine)** · **Present bias** (the harm is happening now).
- **Why it matters for the avatar:** She's a chronic procrastinator on this out of overwhelm and dread. Honest urgency gives her permission to act now — while fake urgency would trip her scam alarm and undo the trust the page just built.

---

### SECTION 13 — Final CTA (Peak-End Close)

```
┌─────────────────────────────────────────┐
│   You've been carrying this alone.       │
│   You don't have to anymore.             │
│                                          │
│   [ ▶ WATCH: HOW IT WORKS (FREE) ]        │  ← primary
│   [   Book your free strategy call   ]   │  ← secondary
│                                          │
│   ✓ Since 2004  ✓ Licensed & bonded (OK) │
│   ✓ Real cases on tape                   │
└─────────────────────────────────────────┘
```
- **Name:** Final CTA
- **Goal:** Close on the strongest emotional note + both CTAs, one last time.
- **UI/UX:** Big, warm, empowering. Restate the emotional payoff (control/not-alone), then the dual CTA with the same hierarchy as the hero. Repeat trust bar for the skimmers who jumped straight to the bottom.
- **Cognitive biases:** **Peak-end rule** (end on the emotional high) · **Mere-exposure** (CTA seen repeatedly now feels familiar/safe) · **Identity/aspiration** ("take back control").
- **Why it matters for the avatar:** Many will scroll to the bottom before deciding. The close must re-deliver the core emotional promise — *you're not alone and you can take control* — and make the safe next step obvious.

---

### PERSISTENT / MICRO ELEMENTS

- **Sticky CTA bar** (mobile + desktop): appears on scroll → primary "Watch How It Works" + "Book a Call." Always one tap away.
- **Exit-intent (desktop) / scroll-depth prompt (mobile):** offer the webinar as the softer catch for those not ready to book. ⚠️ keep honest, no dark patterns.
- **Click-to-call** phone link in the header for the highest-intent, in-crisis visitors who want a human *now*.
- **Trust bar** repeated at hero, mid-page, and close for skimmers.

### FOOTER (compliance-critical)

```
┌─────────────────────────────────────────┐
│  Contact · OKC office address · phone    │
│  Results disclaimer · earnings disclaimer│
│  "Not legal advice" statement ⚠️          │
│  Licensing/bonding statement (OK)        │
│  Privacy · Terms · CROA-required notices⚠│
└─────────────────────────────────────────┘
```
- **Goal:** Legitimacy + legal coverage. ⚠️ CROA/FTC-required disclosures and any "not legal advice" / attorney-status language must be reviewed by counsel. Consistent credentials ("since 2004") everywhere.

---

## Section order at a glance

Hero → Pain Mirror → Reframe → Meet Vance → Mechanism → Proof (calls) → Proof (results) → Proof (testimonials) → How It Works → Objection Crusher → Risk Reversal → Honest Urgency → Final CTA → Footer.

**The narrative arc:** *I see you (pain) → it's not your fault (reframe) → here's a real person who fights this (Vance) → here's how it's different (mechanism) → here's the proof (calls/results/testimonials) → here's your simple safe step (how it works) → your fears, handled (objections) → no risk (reversal) → why now (urgency) → take back control (close).*

---

## What to measure

- Primary: webinar registration rate + call-booking rate (track separately)
- Scroll depth to each proof section (the calls section especially)
- CTA click distribution (webinar vs call) by traffic temperature → tune hierarchy
- Video/audio play + completion rates on the recorded calls
- Mobile vs desktop conversion (expect mobile-dominant)

---

## Open items ⚠️ (inherited)

1. **Attorney/mechanism wording** — determines how strong the Mechanism, Hero, and "hold them accountable" copy can be.
2. **Guarantee** — reconcile 50% vs 100%, legal review, before Risk Reversal ships.
3. **Pricing/advance-fee** — resolved at the call/close stage, not on the page.
4. **Real results captions + disclaimers** — convert image-based proof to legible text.
5. **Webinar-first vs call-first hierarchy** — confirm with your traffic temperature/data.
6. **Meta ad-category compliance** — the ads pointing here, and the page claims, must meet restricted financial-services rules.

---
*Draft v1 — built from the offer intake, both sites, the litigation map, and the avatar/offer/voice docs. Design tokens intentionally deferred to the brand guideline file. Nothing marked ⚠️ ships without Vance's confirmation and, for guarantee/claims/disclosures, legal review.*
