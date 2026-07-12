"use client";

import { site } from "@/config/site-v3";
import { Reveal } from "../../marketing-v3/shared/primitives";
import { useRevealChildren, useScrollScene } from "../../marketing-v3/shared/hooks";

/**
 * v4 "Statute // on the record" (the reframe gather scene). Scattered words
 * converge into "THE LAW IS ALREADY / ON YOUR SIDE" (line break after ALREADY).
 * Behind them: a drifting smoke layer + a fine line pattern. Once the words have
 * gathered (progress past the threshold) the container gets `.settled`, which
 * underlines "YOUR SIDE" and gives it a soft neon glitch in the accent color
 * (see `.v4-reframe-*` / `.v4-gather-neon` rules in v3.css).
 */
// Words fully gather by 70% of the scroll, then hold gathered for the rest.
const G = "min(1, var(--p) / 0.7)";

export function ReframeGatherV4() {
  const { ref, progress } = useScrollScene<HTMLDivElement>();
  const words = site.reframe.gatherWords;
  const settled = progress >= 0.72;

  const nodes: React.ReactNode[] = [];
  words.forEach((w, i) => {
    const sx = (i % 2 ? -1 : 1) * (140 + ((i * 37) % 180));
    const sy = ((i * 53) % 3 ? -1 : 1) * (70 + ((i * 29) % 130));
    const sr = (i % 2 ? -1 : 1) * (8 + ((i * 13) % 18));
    const neon = w === "YOUR" || w === "SIDE";
    nodes.push(
      <span
        key={`w${i}`}
        className={neon ? "v4-gather-neon" : undefined}
        style={{
          color: neon ? undefined : "var(--v3-ink)",
          transform: `translate3d(calc(${sx}px * (1 - ${G})), calc(${sy}px * (1 - ${G})), 0) rotate(calc(${sr}deg * (1 - ${G})))`,
          opacity: `calc(0.1 + 0.9 * ${G})` as unknown as number,
          filter: `blur(calc((1 - ${G}) * 7px))`,
        }}
      >
        {w}
      </span>,
    );
    // line break after "ALREADY", before "ON"
    if (w === "ALREADY") {
      nodes.push(
        <div key="break" aria-hidden style={{ flexBasis: "100%", height: 0 }} />,
      );
    }
  });

  return (
    <section id="reframe">
      <div ref={ref} className="v3-scene" style={{ minHeight: "300vh" }}>
        <div className="v3-scene-sticky">
          {/* OKC image + smoke + line-pattern background, revealed only at the
              center so the section blends seamlessly into its neighbors. */}
          <div className="v4-reframe-bg" aria-hidden>
            <div className="v4-reframe-img" />
            <div className="v4-reframe-smoke" />
            <div className="v4-reframe-smoke two" />
            <div className="v4-reframe-lines" />
            <div className="v4-reframe-glow" />
          </div>

          <div aria-hidden className="v3-scan in" style={{ top: "18%" }} />
          <div className="v3-wrap relative text-center" style={{ zIndex: 3 }}>
            <span
              className="v3-mono"
              style={{
                fontSize: 12,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "var(--v3-accent)",
              }}
            >
              {site.ev.kickers.reframe}
            </span>
            <p
              className="v3-serif-em mx-auto mt-6"
              style={{ fontSize: "clamp(15px,2vw,20px)", color: "var(--v3-mut)", maxWidth: 620 }}
            >
              {site.reframe.kicker}
            </p>
            <div className={`v3-gather mt-8 ${settled ? "settled" : ""}`}>
              {nodes}
            </div>
            <p className={`v4-reframe-sub ${settled ? "in" : ""}`}>
              You just need{" "}
              <span style={{ color: "var(--v3-ink)" }}>the right person</span> to
              use it.
            </p>
          </div>
        </div>
      </div>

      {/* the two statutes, revealed after the scene */}
      <ReframeLawsV4 />
    </section>
  );
}

function ReframeLawsV4() {
  const ref = useRevealChildren<HTMLDivElement>();
  // Split off the opening sentence so it can get a left→right highlight sweep.
  const body = site.reframe.body;
  const marker = "protect you.";
  const cut = body.indexOf(marker);
  const lead = cut >= 0 ? body.slice(0, cut + marker.length) : body;
  const rest = cut >= 0 ? body.slice(cut + marker.length) : "";
  return (
    <div className="v3-section" style={{ borderTop: "1px solid var(--v3-line-soft)" }}>
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <p style={{ fontSize: "clamp(20px,3vw,30px)", color: "var(--v3-mut)", maxWidth: 780, lineHeight: 1.5 }}>
            <span className="v4-highlight">{lead}</span>
            {rest}
          </p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {site.reframe.laws.map((l, i) => (
            <div
              key={l.abbr}
              className="v3-reveal v3-panel v3-corner relative p-7"
              data-delay={((i % 2) + 1) as 1 | 2}
              style={{ borderRadius: 4 }}
            >
              <div className="flex items-baseline justify-between">
                <span className="v3-display" style={{ fontSize: 40, color: "var(--v3-accent)" }}>
                  {l.abbr}
                </span>
                <span
                  className="v3-mono"
                  style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--v3-faint)", textTransform: "uppercase" }}
                >
                  STATUTE 0{i + 1}
                </span>
              </div>
              <div className="v3-mono mt-1" style={{ fontSize: 12, color: "var(--v3-mut)" }}>
                {l.name}
              </div>
              <p className="mt-4" style={{ fontSize: 16, color: "var(--v3-mut)", lineHeight: 1.55 }}>
                {l.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
