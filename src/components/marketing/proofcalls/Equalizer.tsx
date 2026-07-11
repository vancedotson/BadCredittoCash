/** Little bouncing equalizer used as the "now playing" cue on the active row.
 *  Bars use bg-current, so set the colour via a text-* class on the parent. */
export function Equalizer({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`flex items-end gap-[2px] ${className ?? ""}`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="h-full w-[2px] flex-1 origin-bottom rounded-full bg-current motion-safe:animate-[equalize_900ms_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
