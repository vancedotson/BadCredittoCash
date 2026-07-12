"use client";

import { site } from "@/config/site-v3";
import { useRevealChildren } from "../../marketing-v3/shared/hooks";
import { PersonIcon } from "@/components/marketing-v2/Icons";

// ⚠️ PLACEHOLDER testimonials — extra entries so the wall shows 8. Swap all of
// these for real quotes with names/photos/permissions before launch.
const EXTRA = [
  { quote: "I stopped dreading my phone.", name: "Client ⚠️", location: "Oklahoma City", result: "The dread lifted", photo: "" },
  { quote: "He explained everything. No runaround.", name: "Client ⚠️", location: "Oklahoma City", result: "Straight answers", photo: "" },
  { quote: "For once, someone was in my corner.", name: "Client ⚠️", location: "Oklahoma City", result: "Backed up", photo: "" },
  { quote: "I only wish I'd called sooner.", name: "Client ⚠️", location: "Oklahoma City", result: "Only regret: waiting", photo: "" },
];
const items = [...site.testimonials.items, ...EXTRA];

/* neutral avatar (no fabricated faces) */
function Avatar() {
  return (
    <span
      className="grid shrink-0 place-items-center"
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        border: "1px solid var(--v3-line)",
        color: "var(--v3-faint)",
      }}
    >
      <PersonIcon className="h-5 w-5" />
    </span>
  );
}

function Byline({ t }: { t: (typeof items)[number] }) {
  return (
    <div>
      <div style={{ fontSize: 14, color: "var(--v3-ink)" }}>{t.name}</div>
      <div
        className="v3-mono"
        style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--v3-faint)" }}
      >
        {t.location} · {t.result}
      </div>
    </div>
  );
}

/* Spotlight Wall — hover dims siblings and pops the focused card. Now 8 cards. */
export function TestiSpotlight() {
  const ref = useRevealChildren<HTMLDivElement>();
  const tilt = ["-2deg", "1.5deg", "-1deg", "2deg"];
  return (
    <div
      className="v3-wrap v4-testi-spot grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
      ref={ref}
    >
      {items.map((t, i) => (
        <article
          key={i}
          className="v4-testi-card v3-reveal v3-panel relative p-6"
          data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
          style={{ borderRadius: 6, transform: `rotate(${tilt[i % 4]})` }}
        >
          <span
            aria-hidden
            className="v3-display"
            style={{ fontSize: 54, lineHeight: 0.7, color: "var(--v3-accent)", opacity: 0.5 }}
          >
            &ldquo;
          </span>
          <p
            className="v3-serif-em mt-2"
            style={{ fontSize: 19, color: "var(--v3-ink)", lineHeight: 1.4 }}
          >
            {t.quote}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Avatar />
            <Byline t={t} />
          </div>
        </article>
      ))}
    </div>
  );
}
