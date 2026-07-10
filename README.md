# Vance Dotson — "Bad Credit to Cash" sales page

A dual-conversion sales page (watch free webinar **/** book free strategy call)
for **Vance Dotson**, a veteran consumer advocate who uses federal law
(FCRA/FDCPA) to challenge inaccurate credit reporting and stop debt-collector
harassment. Built with **Next.js (App Router)**, **TypeScript**, **Tailwind v4**.

## Strategy documents (source of truth)

The page is built directly from these — refer to them before changing copy,
layout, or design:

| File | Governs |
|---|---|
| `sales-page-structure (1).md` | Section-by-section layout & funnel logic |
| `brand-voice-style-guide.md` | How the copy sounds (voice, compliance) |
| `brand-guideline.md` | Colors, type, components (visual system) |
| `target-audience-avatar.md` | Who it's for ("Denise") |
| `offer-detailed.md` | What's offered + compliance guardrails |

## Getting started

```bash
npm run dev
```

- Sales page: [http://localhost:3000](http://localhost:3000)
- Dashboard (internal): [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Where things live

```
src/
  app/
    page.tsx              # Sales page — composes the 14 sections in arc order
    thank-you/page.tsx    # Post-registration confirmation (noindex)
    dashboard/            # Internal lead/behaviour dashboard
    api/{lead,track}/     # Registration + behaviour events -> store
    globals.css           # Brand design tokens (brand-guideline §13)
  components/marketing/    # One component per section + Header/StickyCta/CtaButtons/TrustBar
  config/site.ts           # ALL page copy — edit content here (see below)
  lib/{store,tracking,supabase}.ts  # Data store seam (Supabase-ready), tracking
```

## Editing copy

All page copy lives in [`src/config/site.ts`](src/config/site.ts), written in
Vance's voice and in the compliance-**safe** framing. Design tokens are in
[`src/app/globals.css`](src/app/globals.css).

## ⚠️ MUST resolve before this goes live

The copy is written safely, but these are flagged with `⚠️` in `site.ts` and in
component comments — nothing should ship publicly until confirmed:

1. **Attorney status** — strengthens/limits the "hold accountable" mechanism wording.
2. **Guarantee** — the 50% vs 100% contradiction must be reconciled + CROA legal review (currently NOT published).
3. **Pricing / advance-fee** — never on this page; resolved at the call stage.
4. **Real assets** — Vance's photo, recorded-call clips, video testimonials, and result captions are placeholders.
5. **Real contact** — phone `(405) 555-0123`, email, and OKC address are placeholders.
6. **Licensing & disclaimers** — footer/legal notices need CROA/FTC review.
7. **Meta ad-category compliance** — creative pointing here must meet restricted financial-services rules.

## Membership/data note

Registrations flow into a swappable in-memory store (`src/lib/store.ts`) that
the dashboard reads; connect Supabase later per the steps in that file.
