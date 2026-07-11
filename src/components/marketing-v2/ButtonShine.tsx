/**
 * A light "shine" streak that periodically sweeps across a button.
 * Drop inside a button/link that has `relative overflow-hidden`.
 * Respects prefers-reduced-motion.
 */
export function ButtonShine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-1/4 animate-[shine_5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/55 to-transparent blur-[1px] motion-reduce:hidden"
    />
  );
}
