"use client";

import { useReveal } from "./hooks";

/** Fixed ambient background: engineering grid + accent bloom + animated grain. */
export function Canvas() {
  return (
    <>
      <div className="v3-canvas" aria-hidden />
      <div className="v3-grain" aria-hidden />
    </>
  );
}

/** Mono kicker/eyebrow ("CASE FILE // OPEN"). */
export function Kicker({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`v3-kicker ${className}`}>{children}</span>;
}

/** A section wrapper that draws a one-shot scan-line across its top on reveal. */
export function SectionScan() {
  const ref = useReveal<HTMLDivElement>({ threshold: 0.1 });
  return <div ref={ref} className="v3-scan" aria-hidden />;
}

/** Blur-up reveal wrapper. Reveals itself when scrolled into view. */
export function Reveal({
  children,
  as: Tag = "div",
  delay,
  className = "",
}: {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  delay?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const ref = useReveal<HTMLElement>();
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref}
      className={`v3-reveal ${className}`}
      data-delay={delay}
    >
      {children}
    </Comp>
  );
}

/** Small labelled data field used in metadata rows. */
export function MetaField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="v3-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--v3-faint)",
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--v3-ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
