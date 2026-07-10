# Brand Guideline — Vance Dotson / Bad Credit to Cash

**Prepared for:** Sales page, webinar funnel, and all brand assets
**Companions:** `target-audience-avatar.md`, `offer-detailed.md`, `brand-voice-style-guide.md`, `sales-page-structure.md`
**Primary color direction:** **Blue** (client preference — and strategically correct: blue signals law, trust, stability, and authority, the exact traits this brand needs).

> **Design philosophy that governs everything below:** This audience has been *scammed by loud design* — neon, alarm-red, fake gauges, hype gradients. So for this brand, **restraint reads as legitimacy.** Every choice here is made to look like a *trustworthy professional who's on your side*, not a get-rich guru. Clean, solid, human, credible.

---

## 1. Brand foundation (quick recap)

- **Essence:** A veteran advocate who fights for you against the bureaus and collectors.
- **Personality:** Straight-talking · tough-but-warm · calm · righteous on your behalf · proof-first · zero hype.
- **Promise:** The calls stop, the inaccurate info gets challenged, you take back control — and you might be owed.
- **The feeling the brand should evoke:** *"Finally, someone strong and legitimate is on my side."*
- **Design north star:** Credible over impressive. Human over corporate. Solid over flashy.

---

## 2. Color palette

Built on blue as the anchor, with a warm accent for action. Ratios follow the **60 / 30 / 10 rule**: ~60% neutrals/white, ~30% blue family, ~10% action accent.

### Primary — Blue family (the brand)

| Name | Hex | RGB | Use |
|---|---|---|---|
| **Advocate Navy** | `#0F2C4C` | 15, 44, 76 | Deep authority — headers, footer, primary text on light, hero backgrounds. The "law & trust" anchor. |
| **Trust Blue** | `#1E5FA3` | 30, 95, 163 | The core brand blue — links, secondary buttons, icons, highlights, brand marks. |
| **Sky Tint** | `#EAF2FB` | 234, 242, 251 | Soft blue background wash for alternating sections / cards. Keeps the page calm and blue-forward without heaviness. |

### Action accent (CTAs) — the 10%

| Name | Hex | RGB | Use |
|---|---|---|---|
| **Justice Gold** | `#F2A93B` | 242, 169, 59 | **Primary CTA color** (webinar button). Warm, premium, high-contrast against blue, and — crucially — *not* alarm-red. Pops the eye without screaming "scam." |
| **Gold Deep** | `#D98E1F` | 217, 142, 31 | CTA hover / pressed state. |

> **Why gold, not red or bright green:** on a blue base, gold gives maximum attention-pull with a *premium, credible* feel (the classic navy-and-gold trust pairing used by legal/financial institutions). Red would read as alarm/scam; a neon green would read as hype. If the client prefers a "go/money" cue, **Signal Green `#1F9D57`** is an acceptable alternative CTA accent — pick ONE and use it consistently.

### Semantic (functional, used sparingly)

| Name | Hex | Use |
|---|---|---|
| **Signal Green** | `#1F9D57` | Success states, checkmarks, "verified/results" ticks. |
| **Alert Red** | `#C0392B` | Errors/validation **only**. **Never** for marketing urgency or countdowns. |

### Neutrals (the 60%)

| Name | Hex | Use |
|---|---|---|
| **Ink** | `#16202B` | Body text (near-black with a blue undertone so it harmonizes with navy). |
| **Slate** | `#4A5A6A` | Secondary text, captions, sub-labels. |
| **Mist** | `#E4E9EE` | Borders, dividers, input outlines. |
| **Cloud** | `#F5F7FA` | Light section backgrounds. |
| **White** | `#FFFFFF` | Base background, cards, text on dark blue. |

### Contrast / accessibility (WCAG AA minimum)

- **White on Advocate Navy** → excellent (use for hero text on navy).
- **Ink on White / Cloud / Sky Tint** → excellent (default body).
- **White on Trust Blue** → passes AA for buttons/large text.
- **Ink (`#16202B`) on Justice Gold** → **use dark Ink text on gold buttons**, not white — this is the readable, accessible combo. Never white text on gold.
- Always verify any new pairing hits **4.5:1** (normal text) / **3:1** (large text).

### Palette usage rules
- Blue leads. Gold is a spotlight, not a floodlight — reserve it almost exclusively for the action you want taken.
- Backgrounds alternate White ↔ Cloud ↔ Sky Tint to create rhythm without clutter.
- Navy anchors the top (nav) and bottom (footer) to "frame" the page in authority.
- Never more than one gold CTA competing for attention in a single viewport.

---

## 3. Typography

Chosen for **mobile legibility + sturdy, trustworthy character** (the avatar reads on a phone). All free via Google Fonts for easy web implementation.

### Type families

| Role | Font | Alt | Character |
|---|---|---|---|
| **Headlines** | **Staatliches** (400, all-caps) — Brian LaRossa, Erica Carras | Oswald / Anton | Bold, condensed, all-caps display — commanding and confident, like a masthead. Used for **all** headlines project-wide (hero H1 + every section H2/H3). |
| **Sub-labels / buttons / wordmark** | **Poppins** (SemiBold 600 / Bold 700) | Montserrat | Eyebrows, CTA labels, credential lines, the wordmark — friendly-but-sturdy support for the Staatliches headlines. |
| **Body** | **Inter** (Regular 400 / Medium 500) | Source Sans 3 | Exceptional small-size legibility on mobile; neutral and trustworthy. Never set body/subheads in Staatliches (all-caps hurts readability). |
| **Optional authority accent** | **Source Serif 4** (for pull-quotes/testimonials only) | Lora | Adds a touch of legal/gravitas to quotes. Use sparingly; keep UI sans-dominant. |

### Type scale (mobile-first; scale up ~15–20% on desktop)

| Token | Size / Line-height | Weight | Use |
|---|---|---|---|
| Display / H1 | 48–72px / 1.02 | Staatliches 400 | Hero headline (all-caps) |
| H2 | 28–40px / 1.15 | Staatliches 400 | Section headers (all-caps) |
| H3 | 20–24px / 1.2 | Staatliches 400 | Card titles (all-caps) |
| Body Large | 18–20px / 1.5 | Regular 400 | Lead paragraphs |
| Body | 16–18px / 1.55 | Regular 400 | Default (never below 16px) |
| Caption | 14px / 1.4 | Medium 500 | Labels, disclaimers-that-must-stay-legible |
| Button | 17–18px / 1 | SemiBold 600 | CTA labels |

### Typography rules
- **Short lines, short paragraphs** (voice guide §11) — 1–3 lines each.
- Headlines (Staatliches, all-caps) in Advocate Navy on light, White on navy. A touch of letter-spacing (~0.01–0.04em) helps the caps breathe.
- Staatliches is caps-only and single-weight — use it for headlines, never for body or long subheads (readability).
- Disclaimers get **Caption (14px) minimum** — never the tiny 8px gray that signals "hiding something." Legible disclaimers = trust *and* compliance.
- Left-align body for readability; center only short headlines/CTAs.

---

## 4. Logo & wordmark

> ⚠️ **Client asset needed:** confirm whether an existing logo file exists (and get vector/PNG in all color variants). If none exists, recommend a simple, sturdy **wordmark** — "VANCE DOTSON" in Poppins Bold, Advocate Navy — optionally paired with a **restrained shield or scales motif** (protection / fairness) in Trust Blue. Keep it clean; avoid clip-art gavels and dollar signs (scam-adjacent).

**Usage rules (apply to whatever logo is finalized):**
- **Clear space:** keep padding ≥ the height of the "V" on all sides.
- **Minimum size:** legible at 120px wide (desktop nav) / 100px (mobile).
- **Color variants:** full-color, all-navy (mono), and all-white (for navy/photo backgrounds).
- **Don'ts:** don't stretch, recolor outside the palette, add drop-shadows/glows, place on low-contrast backgrounds, or rotate.

---

## 5. Buttons & CTAs (component spec)

Hierarchy is critical because the page runs a **dual CTA** (webinar primary, call secondary — see `sales-page-structure.md`).

| Button | Fill | Text | Border | State: hover |
|---|---|---|---|---|
| **Primary CTA** (Watch the webinar) | Justice Gold `#F2A93B` | Ink `#16202B` | none | Gold Deep `#D98E1F` |
| **Secondary CTA** (Book a call) | Trust Blue `#1E5FA3` | White | none | Advocate Navy `#0F2C4C` |
| **Tertiary / ghost** (low-priority links) | transparent | Trust Blue | 1.5px Trust Blue | Sky Tint fill |

**Button rules:**
- Corner radius **8px** (friendly but serious — not pill-shaped/hype, not sharp/cold).
- Generous padding: min **16px vertical / 28px horizontal**; full-width on mobile.
- Tap target **≥ 44px** tall (accessibility + thumb-friendly).
- Label in verbs + benefit: "Watch How It Works (Free)", "Book My Free Call" — never "Submit."
- **Gold always signals the single most-wanted action.** Blue supports. This visual hierarchy is how the dual-CTA strategy stays legible.

---

## 6. UI components & tokens

- **Cards** (results, testimonials): White fill, 12px radius, 1px Mist border, soft shadow (`0 2px 8px rgba(15,44,76,0.08)` — a subtle navy-tinted shadow, never harsh). Generous internal padding.
- **Accordions** (FAQ / objection crusher): Mist dividers, Trust Blue chevron, Ink question / Slate answer.
- **Trust bar chips:** small, Signal Green or Gold checkmark + Slate label.
- **Media players** (recorded calls / testimonials): navy frame, gold play button, **captions on by default**.
- **Sticky CTA bar:** Advocate Navy background, gold primary + blue secondary buttons.
- **Section rhythm:** alternate White / Cloud / Sky Tint backgrounds; navy for hero + footer bookends.
- **Spacing scale:** 8-point system (8 / 16 / 24 / 32 / 48 / 64px). Lean generous — white space signals calm and credibility.

---

## 7. Imagery & photography

**The single most important brand asset is authenticity.** Real beats polished every time for this audience.

**Use:**
- **Real photos of Vance** — at his actual OKC office, warm natural light, looking at camera, approachable but serious. This is the anti-scam centerpiece.
- **Relatable real people** for testimonials — his demographic (working, everyday, 35–60), genuine expressions, not model-perfect.
- **Clean, styled receipts/results** — documented outcomes presented legibly (with disclaimer).
- Documentary/candid feel over staged corporate.

**Avoid (all read as scam or hype):**
- Cheesy stock: fanned cash, handshake-in-suit, thumbs-up businessman, model families.
- Alarm graphics: red warning icons, sirens, giant down-arrows.
- Fake "score gauges" jumping to 800, or any visual implying a guaranteed score.
- Over-filtered, over-saturated, or gradient-heavy imagery.

**Treatment:** natural color, light navy or gold subtle overlays where text sits on photos, always maintain contrast for legibility.

---

## 8. Iconography & graphic motifs

- **Icon style:** simple line icons, consistent ~2px stroke, rounded joints. In Trust Blue or Ink; checkmarks in Signal Green/Gold.
- **Restrained motif (optional):** a subtle **shield** (protection) or **balance/scales** (fairness/law) can recur lightly as a brand cue — in headers, section dividers, or the trust bar. Keep it minimal and modern; avoid literal gavels, cartoon police, or dollar-sign clip art.
- **No** heavy drop-shadows, bevels, glows, or 3D effects — flat, clean, modern.

---

## 9. Voice & tone (cross-reference)

Visual identity and voice must feel like the same person. Full detail in `brand-voice-style-guide.md`; in brief: **plain-spoken, tough-but-warm, righteous-not-preachy, proof-first, zero hype.** The design should look the way that voice sounds — calm, solid, credible, on your side.

---

## 10. Do's & don'ts (visual)

**Do**
- ✅ Lead with blue; use gold only to spotlight the action.
- ✅ Keep it clean, spacious, and legible.
- ✅ Use real photography of Vance and real clients.
- ✅ Keep disclaimers legible (14px min).
- ✅ Maintain one clear primary action per screen.

**Don't**
- ❌ Use alarm-red, neon, or hype gradients (scam signals to this audience).
- ❌ Add fake countdown timers, spinning "score" gauges, or flashing elements.
- ❌ Crowd the page — clutter reads as untrustworthy here.
- ❌ Put white text on gold (fails contrast) or navy text on Trust Blue.
- ❌ Use cheesy financial stock imagery.
- ❌ Bury disclaimers in tiny gray type.

---

## 11. Accessibility standards

- WCAG **AA** minimum on all text/background pairings (4.5:1 body, 3:1 large).
- Body text **≥ 16px**; comfortable line-height (1.5+).
- Tap targets **≥ 44px**.
- **Captions on all video/audio** (muted autoplay is the norm on Facebook).
- Don't rely on color alone to convey meaning (pair with icon/label).
- Alt text on all meaningful images.

---

## 12. Compliance-adjacent visual notes ⚠️

- **Disclaimers must be visibly legible** (Caption/14px, Slate on light) — required results/earnings/"not legal advice" notices, and any CROA-required disclosures. Legibility here is both a trust signal and a compliance safeguard.
- **No visual devices that manufacture false urgency** (countdowns, "3 spots left!!" flashing) — they're scam-coded to this audience *and* attract regulatory scrutiny in this category.
- Any "results" visual must sit with its disclaimer in the same viewport.
- ⚠️ Licensing/bonding (OK) and attorney-status language must match whatever Vance confirms.

---

## 13. Quick-reference token sheet

```
COLORS
  Advocate Navy   #0F2C4C   authority / headers / footer / hero
  Trust Blue      #1E5FA3   brand / links / secondary CTA / icons
  Sky Tint        #EAF2FB   soft section background
  Justice Gold    #F2A93B   PRIMARY CTA (text = Ink)
  Gold Deep       #D98E1F   CTA hover
  Signal Green    #1F9D57   success / checkmarks / (alt CTA)
  Alert Red       #C0392B   errors only — never marketing
  Ink             #16202B   body text
  Slate           #4A5A6A   secondary text / disclaimers
  Mist            #E4E9EE   borders / dividers
  Cloud           #F5F7FA   light background
  White           #FFFFFF   base / cards / text on navy

TYPE
  Headlines  Staatliches 400  ALL-CAPS  (alt: Oswald/Anton)  — all H1/H2/H3
  Sub/labels/buttons/wordmark  Poppins 600/700  (alt: Montserrat)
  Body       Inter    400/500   (alt: Source Sans 3)
  Quotes     Source Serif 4     (optional, sparing)
  Base body  16–18px  ·  H1 48–72px  ·  disclaimer 14px min

BUTTONS
  Primary    Gold fill + Ink text        radius 8px
  Secondary  Trust Blue fill + White     radius 8px
  Ghost      Trust Blue outline          radius 8px
  Min height 44px · full-width on mobile

SPACING  8-pt system: 8/16/24/32/48/64
SHADOW   0 2px 8px rgba(15,44,76,0.08)
RADIUS   buttons 8px · cards 12px
```

---

## Open items ⚠️
1. **Logo:** confirm existing asset or approve a wordmark direction.
2. **CTA accent:** confirm Justice Gold (recommended) vs Signal Green — pick one.
3. **Real photography:** source authentic photos of Vance + client testimonials.
4. **Exact site colors:** if the client wants to match the current vancedotson.com blue precisely, provide the hex and I'll align the palette.
5. **Attorney-status / licensing language:** must match Vance's confirmation wherever it appears.

---
*Draft v1 — blue-anchored per client preference, designed for a scam-wary, mobile-first, working-class audience. Built to pair with the avatar, offer, voice, and sales-page-structure docs. Items marked ⚠️ need client input/assets before final production.*
