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

/**
 * The version toggle (V1 / V2 / V3). Renders nothing without a provider.
 * `panel` = rendered inside the mobile hamburger menu (always shown); otherwise
 * it's the desktop bar instance (hidden below md). `onPick` fires after a switch
 * (used to close the mobile menu).
 */
export function NavToggles({
  panel = false,
  onPick,
}: {
  panel?: boolean;
  onPick?: () => void;
}) {
  const demo = useDemo();
  if (!demo) return null;
  const { version, setVersion } = demo;

  return (
    <div
      className={`v4-navtoggles ${panel ? "v4-navtoggles--panel" : "hidden md:flex"}`}
      role="group"
      aria-label="Design version"
    >
      <div className="v4-navtoggle-group">
        {VERSIONS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={version === v}
            onClick={() => {
              setVersion(v);
              onPick?.();
            }}
          >
            V{v}
          </button>
        ))}
      </div>
    </div>
  );
}
