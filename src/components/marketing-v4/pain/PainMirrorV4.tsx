"use client";

import { site } from "@/config/site-v3";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useRevealChildren } from "../../marketing-v3/shared/hooks";

/**
 * v4 "Sound familiar?" (Pain Mirror). Each numbered point is an interactive row:
 * on hover/focus it expands, fades in a background image (behind a strong dark
 * overlay for legibility), and reveals a storytelling paragraph plus a "distress
 * level" meter (a yellow→red bar rating how disturbing that feeling is). Styling
 * lives in `.v4-pain-*` rules in v3.css; each row is keyboard-focusable.
 *
 * ⚠️ Background images are PLACEHOLDER mood textures — swap for representative
 *    photography (a lit-up phone, a credit report, etc.). Storytelling copy and
 *    the distress levels are subjective/emotional framing, not factual claims.
 */
const DETAIL: { para: string; img: string; level: number }[] = [
  {
    para: "You know the ringtone by heart now. You let it go to voicemail, but the knot in your stomach doesn't. It just waits for the next call.",
    img: "/v3/tex-fog.jpg",
    level: 74,
  },
  {
    para: "They know calling your job is humiliating. That's the point. They're betting the pressure of everyone finding out makes you pay just to make it stop. A lot of what they do isn't just rude. It crosses a line the law drew.",
    img: "/oklahoma-night.png",
    level: 86,
  },
  {
    para: "An account you never opened. A balance that was never yours. A late payment that never happened. You've read every line, and it doesn't belong there, but it's still dragging your score down.",
    img: "/v3/tex-ridge.jpg",
    level: 80,
  },
  {
    para: "You did it by the book. You mailed the dispute. You waited. And it came back marked “verified,” as if no one even looked. Most of the time, no one did.",
    img: "/v3/tex-water.jpg",
    level: 90,
  },
  {
    para: "They took the money up front and mailed the same template letters you could have sent yourself. When it didn't work, they blamed you. You were never the problem. You just needed someone who knows the law.",
    img: "/oklahoma.png",
    level: 96,
  },
];

function tier(level: number): { color: string; word: string } {
  if (level >= 90) return { color: "#e5484d", word: "Critical" };
  if (level >= 80) return { color: "#ef6b3b", word: "Severe" };
  if (level >= 70) return { color: "#f2994a", word: "High" };
  return { color: "#f2c94c", word: "Elevated" };
}

export function PainMirrorV4() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="pain">
      <SectionScan />
      <div className="v3-wrap" ref={ref}>
        <Reveal>
          <Kicker>{site.ev.kickers.pain}</Kicker>
        </Reveal>
        <Reveal as="h2" className="v3-display mt-5">
          <span style={{ fontSize: "clamp(38px,6vw,74px)" }}>
            {site.painMirror.heading}
          </span>
        </Reveal>

        <div className="mt-10">
          {site.painMirror.points.map((p, i) => {
            const d = DETAIL[i];
            const t = tier(d.level);
            return (
              <div
                key={i}
                className="v4-pain-row v3-reveal"
                data-delay={((i % 4) + 1) as 1 | 2 | 3 | 4}
                tabIndex={0}
              >
                <div
                  className="v4-pain-bg"
                  aria-hidden
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(6,6,7,0.97) 0%, rgba(6,6,7,0.9) 50%, rgba(6,6,7,0.82) 100%), url(${d.img})`,
                  }}
                />
                <div className="v4-pain-body">
                  <div className="flex items-start gap-5">
                    <span
                      className="v4-pain-num v3-mono"
                      style={{ paddingTop: 4, flex: "0 0 auto" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="v4-pain-point">{p}</p>
                      <div className="v4-pain-detail">
                        <p className="v4-pain-para">{d.para}</p>
                        <div className="v4-pain-meter">
                          <span className="v4-pain-meter-cap">Distress level</span>
                          <div className="v4-pain-meter-track">
                            <div
                              className="v4-pain-meter-cover"
                              style={{ width: `${100 - d.level}%` }}
                            />
                          </div>
                          <span
                            className="v4-pain-meter-word"
                            style={{ color: t.color }}
                          >
                            {t.word} · {d.level}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Reveal className="mt-10">
          <p
            className="v3-serif-em"
            style={{
              fontSize: "clamp(22px,3.4vw,34px)",
              color: "var(--v3-accent)",
            }}
          >
            {site.painMirror.pivot}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
