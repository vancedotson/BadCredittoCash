"use client";

/**
 * Reusable design-comparison overlay. Floating panel that lets the user click
 * between numbered design variants and see them swap live on the page.
 * Used for every "give me 3 options to pick from" review round. Once a choice
 * is made, bake it in and remove the switcher + unused variants.
 */
export type DesignOption = { id: number; name: string };

export function DesignSwitcher({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: DesignOption[];
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <div className="fixed right-3 top-1/2 z-[70] w-52 -translate-y-1/2 rounded-xl border border-mist bg-card p-2 shadow-[0_10px_40px_rgba(15,44,76,0.22)]">
      <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate">
        {label}
      </p>
      <div className="space-y-1">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              aria-pressed={active}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                active ? "bg-navy text-white" : "text-body hover:bg-cloud"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                  active ? "bg-gold text-ink" : "bg-cloud text-slate"
                }`}
              >
                {o.id}
              </span>
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
