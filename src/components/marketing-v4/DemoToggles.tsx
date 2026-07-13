"use client";

import { createContext, useContext } from "react";

/** Three showcase versions:
 *  1 = Case File dark, justice gold
 *  2 = Case File dark, credibility blue
 *  3 = blue dark/light duotone (the V5 design) */
export type Version = "1" | "2" | "3";

export type DemoState = {
  version: Version;
  setVersion: (v: Version) => void;
};

/** Provided by the /v4 page; consumed by the header to render the toggle.
 *  Null everywhere else (e.g. the standalone /v5 route) so nothing renders. */
export const DemoContext = createContext<DemoState | null>(null);
export const useDemo = () => useContext(DemoContext);

const VERSIONS: Version[] = ["1", "2", "3"];

/** The in-nav version toggle (V1 / V2 / V3). Renders nothing without a provider. */
export function NavToggles() {
  const demo = useDemo();
  if (!demo) return null;
  const { version, setVersion } = demo;

  return (
    <div className="v4-navtoggles hidden md:flex">
      <div className="v4-navtoggle-group" role="group" aria-label="Design version">
        {VERSIONS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={version === v}
            onClick={() => setVersion(v)}
          >
            V{v}
          </button>
        ))}
      </div>
    </div>
  );
}
