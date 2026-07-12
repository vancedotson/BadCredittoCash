"use client";

import { useEffect, useRef, useState } from "react";

/** True once the user has expressed prefers-reduced-motion. SSR-safe. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * IntersectionObserver reveal: adds the `in` class to the element the returned
 * ref is attached to the first time it scrolls into view. Reduced-motion users
 * get `in` immediately (no transition, thanks to the CSS media query).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { threshold = 0.2, rootMargin = "0px 0px -10% 0px", once = true } =
      options;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            if (once) io.unobserve(e.target);
          } else if (!once) {
            e.target.classList.remove("in");
          }
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/**
 * Auto-reveal helper: observes every element matching `selector` inside the
 * container and toggles `.in` as they enter. Handy for a whole section of
 * `.v3-reveal` children without wiring a ref to each.
 */
export function useRevealChildren<T extends HTMLElement = HTMLElement>(
  selector = ".v3-reveal, .v3-tm, .v3-redact, .v3-stamp",
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll(selector));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [selector]);
  return ref;
}

/**
 * Sticky-scene scroll progress. Attach the returned ref to a tall `.v3-scene`
 * wrapper (which contains a sticky child). Returns a live 0..1 `progress`
 * reflecting how far the scene has been scrolled through, written both to
 * React state (throttled via rAF) and to the `--p` CSS custom property on the
 * element for cheap CSS-driven animation. Disabled (stays 1) for reduced motion.
 */
export function useScrollScene<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    if (reduced) {
      el.style.setProperty("--p", "1");
      raf = requestAnimationFrame(() => setProgress(1));
      return () => cancelAnimationFrame(raf);
    }
    const compute = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // total scrollable distance while the sticky child is pinned
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      const p = total > 0 ? scrolled / total : 0;
      el.style.setProperty("--p", p.toFixed(4));
      setProgress(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    // defer the initial measurement into a frame (keeps setState out of the
    // effect body per react-hooks/set-state-in-effect)
    raf = requestAnimationFrame(compute);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return { ref, progress };
}

/** Whole-page scroll progress (0..1), written to `--page` on <html> for the rail. */
export function usePageProgress() {
  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const p = max > 0 ? doc.scrollTop / max : 0;
      doc.style.setProperty("--page", p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

/** Fires once the window has scrolled past `y` px (for the sticky CTA). */
export function useScrolledPast(y: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const on = () => setPast(window.scrollY > y);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [y]);
  return past;
}
