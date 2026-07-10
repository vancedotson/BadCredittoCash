/**
 * Decorative audio waveform for the recorded-call cards. Bars flex to fill the
 * available width (responsive), with the leading ~40% "played" for a real
 * player feel. Placeholder visual until the real audio is wired in.
 */
const BARS = [
  7, 12, 20, 28, 16, 10, 22, 32, 24, 14, 8, 18, 30, 22, 12, 7, 15, 26, 34, 20,
  11, 6, 14, 25, 18, 9, 13, 23, 30, 17, 10, 7, 16, 27, 21, 12, 8, 19, 29, 22,
];

export function Waveform({
  playedClass,
  baseClass,
  className,
}: {
  playedClass: string;
  baseClass: string;
  className?: string;
}) {
  return (
    <div aria-hidden className={`flex items-center gap-[2px] ${className ?? ""}`}>
      {BARS.map((h, i) => (
        <span
          key={i}
          className={`flex-1 rounded-full ${
            i < BARS.length * 0.4 ? playedClass : baseClass
          }`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
