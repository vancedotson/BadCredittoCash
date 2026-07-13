"use client";

import { site } from "@/config/site-v3";
import { Kicker } from "../../marketing-v3/shared/primitives";
import { useScrollScene } from "../../marketing-v3/shared/hooks";

/**
 * v4 "Procedure // 03 steps" (pinned mechanism). Three step colors that walk
 * toward green (gold → lime → green). As the active step advances (1→2→3):
 *  - a large blurred glow of the active color sits on the right of the scene
 *    and cross-fades its color (the "glass" tint changing behind the steps);
 *  - phrases in the headline light up in each step's color — cumulatively:
 *    "mails letters" (step 1), "and hopes" (step 2), "what I do instead" (3);
 *  - the active step card + the progress bar carry that color.
 * Headline text is reconstructed from site.mechanism.heading so the phrases can
 * be individually colored.
 */
// Step colors read from CSS vars, so the accent theme drives the walk
// (gold -> lime -> green on /v4, blue -> cyan -> aqua on /v5).
const stepVar = (i: number) => `var(--v3-step-${i})`;
// ⚠️ PLACEHOLDER stage backgrounds (barely visible) — swap for imagery that
// represents each step: finding violations / holding accountable / results.
const STEP_IMAGES = ["/v3/tex-ridge.jpg", "/v3/tex-fog.jpg", "/oklahoma.png"];

export function MechanismPinnedV4() {
  const { ref, progress } = useScrollScene<HTMLDivElement>();
  const steps = site.mechanism.steps;
  const active = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  const activeColor = stepVar(active);

  // a headline phrase that colors in once its step has been reached
  const hl = (text: string, idx: number) => (
    <span
      style={{
        color: active >= idx ? stepVar(idx) : "var(--v3-heading)",
        transition: "color 0.5s ease",
      }}
    >
      {text}
    </span>
  );

  return (
    <section id="mechanism">
      <div ref={ref} className="v3-scene" style={{ minHeight: "340vh" }}>
        <div className="v3-scene-sticky">
          {/* per-stage background image — cross-fades on scroll as the step
              advances (step 1 / 2 / 3 each get their own backdrop) */}
          <div className="v4-mech-bg" aria-hidden>
            {STEP_IMAGES.map((img, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: i === active ? 1 : 0,
                  transition: "opacity 0.9s ease",
                }}
              />
            ))}
          </div>
          {/* readability veil over the imagery (theme-aware via --v3-bg) */}
          <div className="v4-mech-veil" aria-hidden />
          {/* right-side colored glass blur — subtle tint that follows the step */}
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              right: "-6%",
              top: "50%",
              transform: "translateY(-50%)",
              width: "42%",
              height: "70%",
              borderRadius: "999px",
              backgroundColor: activeColor,
              opacity: 0.06,
              filter: "blur(100px)",
              zIndex: 1,
              transition: "background-color 0.7s ease, opacity 0.7s ease",
            }}
          />

          <div
            className="v3-wrap relative grid w-full items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]"
            style={{ zIndex: 2 }}
          >
            <div>
              <Kicker>{site.ev.kickers.mechanism}</Kicker>
              <h2
                className="v3-display mt-5"
                style={{ fontSize: "clamp(30px,4vw,52px)", maxWidth: 560 }}
              >
                Most credit repair {hl("mails letters", 0)} {hl("and hopes", 1)}.
                Here&apos;s {hl("what I do instead", 2)}:
              </h2>
              <p
                className="mt-5"
                style={{ fontSize: 16, color: "var(--v3-mut)", maxWidth: 460, lineHeight: 1.6 }}
              >
                {site.mechanism.subhead}
              </p>
              {/* progress bar — fills gold → lime → green as you advance */}
              <div className="mt-8 h-px w-full" style={{ background: "var(--v3-line)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(progress * 100)}%`,
                    backgroundImage: `linear-gradient(90deg, ${stepVar(0)}, ${stepVar(1)}, ${stepVar(2)})`,
                    backgroundSize: `${100 / Math.max(progress, 0.01)}% 100%`,
                    backgroundRepeat: "no-repeat",
                    transition: "width 0.1s linear",
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4">
              {steps.map((s, i) => {
                const on = i === active;
                const done = i < active;
                const c = stepVar(i);
                return (
                  <div
                    key={i}
                    className="v3-pin-step v3-panel relative flex gap-5 p-6"
                    style={{
                      borderRadius: 4,
                      opacity: on ? 1 : done ? 0.72 : 0.4,
                      transform: on ? "translateX(8px)" : "none",
                      borderColor: on ? c : "var(--v3-line)",
                      boxShadow: on
                        ? `0 0 0 1px ${c}, 0 10px 26px color-mix(in srgb, ${c} 10%, transparent)`
                        : "none",
                    }}
                  >
                    <span
                      className="v3-display shrink-0"
                      style={{
                        fontSize: 40,
                        lineHeight: 1,
                        color: on || done ? c : "var(--v3-line)",
                        minWidth: 56,
                        transition: "color 0.4s ease",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="v3-display" style={{ fontSize: 22, color: "var(--v3-ink)" }}>
                        {s.title}
                      </h3>
                      <p className="mt-2" style={{ fontSize: 15, color: "var(--v3-mut)", lineHeight: 1.5 }}>
                        {s.body}
                      </p>
                    </div>
                  </div>
                );
              })}
              <p
                className="v3-serif-em mt-3"
                style={{ fontSize: 18, color: activeColor, transition: "color 0.5s ease" }}
              >
                {site.mechanism.kicker}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
