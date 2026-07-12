"use client";

export type V3Variant = "casefile" | "signalroom" | "ledger";

export const V3_VARIANTS: { id: V3Variant; name: string; tag: string }[] = [
  { id: "casefile", name: "Case File", tag: "dossier" },
  { id: "signalroom", name: "Signal Room", tag: "audio-forensics" },
  { id: "ledger", name: "Blacksite Ledger", tag: "brutalist" },
];

/**
 * Floating variant picker (dev/bake-off control). Lets the user compare the
 * three full-page v3 designs and pick one. Persists to localStorage + ?v=.
 */
export function PageSwitcher({
  value,
  onChange,
}: {
  value: V3Variant;
  onChange: (v: V3Variant) => void;
}) {
  return (
    <div className="v3-switcher" role="group" aria-label="Choose a v3 design">
      <span className="v3-switcher-label">Design // pick one</span>
      {V3_VARIANTS.map((v) => (
        <button
          key={v.id}
          type="button"
          aria-pressed={value === v.id}
          onClick={() => onChange(v.id)}
        >
          {v.name}
        </button>
      ))}
    </div>
  );
}
