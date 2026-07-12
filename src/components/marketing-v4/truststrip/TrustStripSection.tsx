"use client";

import { site } from "@/config/site-v3";

/**
 * v4 trust strip — the "Combined" treatment (locked in): a fixed ON FILE tab +
 * two counter-scrolling lanes joined by `//`, with a seamless infinite loop
 * (content repeated so translateX(-50%) wraps with no jump). Hovering the strip
 * expands the band and grows the letters together; the word under the cursor
 * highlights in the accent (see `.v4-combo` rules in v3.css). Reduced-motion
 * pauses the scroll and the transitions.
 */
const CREDS = site.trustBar;
const TAGS = [
  "FCRA",
  "FDCPA",
  "Real cases on tape",
  "Since 2004",
  "Real OKC office",
  "Consumer advocate",
];

const dup = <T,>(a: readonly T[]) => [...a, ...a];
const many = (a: readonly string[]) => [...a, ...a, ...a];
const EDGE_FADE =
  "linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)";

function Lane({
  items,
  reverse,
  seconds,
  accent,
}: {
  items: readonly string[];
  reverse: boolean;
  seconds: number;
  accent: boolean;
}) {
  return (
    <div className="v4-combo-lane" style={{ overflow: "hidden" }}>
      <div
        className="v3-marquee-track"
        style={{
          animationDuration: `${seconds}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {dup(many(items)).map((t, i) => (
          <span key={i} className="v3-mono inline-flex items-center">
            <span
              className={`v4-combo-word ${accent ? "v4-combo-word--cred" : "v4-combo-word--tag"}`}
              style={{ paddingRight: 14 }}
            >
              {t}
            </span>
            <span
              aria-hidden
              style={{ color: "var(--v3-faint)", fontSize: 12, paddingRight: 14 }}
            >
              {"//"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function TrustStripSection() {
  return (
    <div
      className="v4-combo flex items-stretch"
      style={{
        background: "rgba(0,0,0,0.45)",
        borderTop: "1px solid var(--v3-line-soft)",
        borderBottom: "1px solid var(--v3-line-soft)",
      }}
    >
      <div
        className="v3-mono flex items-center gap-2"
        style={{
          flex: "0 0 auto",
          padding: "0 18px",
          fontSize: 10.5,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "var(--v3-accent)",
          borderRight: "1px solid var(--v3-line)",
          background: "rgba(0,0,0,0.5)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--v3-accent)",
            boxShadow: "0 0 10px var(--v3-accent)",
            animation: "v3Fade 1s ease-in-out infinite alternate",
            flex: "0 0 auto",
          }}
        />
        ON FILE
      </div>
      <div
        className="min-w-0 flex-1"
        style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}
      >
        <Lane items={CREDS} reverse={false} seconds={26} accent />
        <div style={{ height: 1, background: "var(--v3-line-soft)" }} />
        <Lane items={TAGS} reverse seconds={34} accent={false} />
      </div>
    </div>
  );
}
