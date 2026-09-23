"use client";

import Image from "next/image";
import { site } from "@/config/site-v3";
import { Kicker, Reveal, SectionScan } from "../../marketing-v3/shared/primitives";
import { useRevealChildren } from "../../marketing-v3/shared/hooks";

/** Factual overview of the public service focus and available call. */
export function MeetVanceV4() {
  const ref = useRevealChildren<HTMLDivElement>();
  return (
    <section className="v3-section" id="meet" style={{ paddingBlock: 0 }}>
      <SectionScan />
      <div
        className="v3-wrap grid items-stretch gap-12 lg:grid-cols-[0.85fr_1.15fr]"
        ref={ref}
      >
        {/* left — full-height photo container matching the hero: Vance over the
            OKC night skyline, feathered so he blends in; border on the right. */}
        <div
          className="relative hidden self-stretch overflow-hidden lg:block"
          style={{ borderRight: "1px solid var(--v3-line)", minHeight: 560, marginBottom: -1 }}
        >
          {/* OKC night skyline behind */}
          <Image
            src="/oklahoma-night.png"
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 42vw, 90vw"
            className="object-cover"
            style={{
              objectPosition: "center 40%",
              opacity: 0.55,
              filter: "grayscale(0.2) contrast(1.05)",
            }}
          />
          {/* Vance on top, feathered on the sides + bottom so he melts into it */}
          <Image
            src="/vance2.png"
            alt="Vance Dotson"
            fill
            sizes="(min-width: 1024px) 42vw, 90vw"
            className="object-cover"
            style={{
              objectPosition: "center top",
              filter: "grayscale(0.12) contrast(1.08)",
              maskImage:
                "linear-gradient(90deg, transparent 0%, #000 16%, #000 80%, transparent 100%), linear-gradient(180deg, #000 82%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent 0%, #000 16%, #000 80%, transparent 100%), linear-gradient(180deg, #000 82%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskComposite: "source-in",
            }}
          />
          {/* blend the image into the page on the top and bottom (the left is
              handled at the section level; the right keeps its border). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, var(--v3-bg) 0%, transparent 15%, transparent 58%, rgba(6,6,7,0.5) 82%, var(--v3-bg) 100%)",
            }}
          />
        </div>

        {/* right — the advocate copy */}
        <div
          className="flex flex-col justify-center"
          style={{ paddingBlock: "clamp(72px,12vh,150px)" }}
        >
          <Reveal>
            <Kicker>{site.ev.kickers.meet}</Kicker>
          </Reveal>
          <Reveal as="h2" className="v3-display mt-5">
            <span style={{ fontSize: "clamp(38px,6vw,72px)" }}>
              {site.meetVance.heading}
            </span>
          </Reveal>
          {site.meetVance.body.map((p, i) => (
            <Reveal key={i} className="mt-5" delay={((i % 3) + 1) as 1 | 2 | 3}>
              <p style={{ color: "var(--v3-mut)", fontSize: 17, lineHeight: 1.6, maxWidth: 560 }}>
                {p}
              </p>
            </Reveal>
          ))}
          <Reveal className="mt-6">
            <p className="v3-serif-em" style={{ fontSize: 20, color: "var(--v3-ink)" }}>
              {site.meetVance.signoff}
            </p>
          </Reveal>
        </div>
      </div>

      {/* section-level left blend: solid page color over the far left (covers
          the container's left edge + margin), fading into the photo — no cut. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          zIndex: 2,
          background:
            "linear-gradient(90deg, var(--v3-bg) 0%, var(--v3-bg) 13%, transparent 30%)",
        }}
      />
    </section>
  );
}
