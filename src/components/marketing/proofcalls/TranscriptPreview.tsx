/**
 * Stylised transcript with a prominent "Violation flagged" callout. Speaker
 * turns are redaction blocks (no fabricated quotes — real captions ship with
 * the recording). Pass `progress` (0–1) to reveal the turns in sync with
 * playback; the flagged banner lights up once the playhead reaches the
 * violation turn. At the default progress of 1 the whole transcript is shown.
 */
const TURNS = [
  { label: "Collector", tone: "collector", widths: ["w-full", "w-4/5"] },
  { label: "Vance", tone: "vance", widths: ["w-3/4"] },
  { label: "Collector", tone: "collector", widths: ["w-full", "w-2/3"] },
  { label: "Collector — flagged", tone: "flag", widths: ["w-11/12", "w-2/3"] },
  { label: "Vance", tone: "vance", widths: ["w-5/6"] },
] as const;

const FLAGGED_INDEX = 3;

function toneClasses(tone: (typeof TURNS)[number]["tone"]) {
  if (tone === "flag") return { labelCls: "text-gold-deep", barCls: "bg-gold/50" };
  if (tone === "vance") return { labelCls: "text-trust", barCls: "bg-trust/15" };
  return { labelCls: "text-slate", barCls: "bg-mist" };
}

export function TranscriptPreview({
  statuteLabel,
  progress = 1,
}: {
  statuteLabel: string;
  progress?: number;
}) {
  const n = TURNS.length;
  const flaggedReached = progress >= FLAGGED_INDEX / n;

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-300 ${
          flaggedReached
            ? "border-gold bg-gold/15 ring-2 ring-gold/40"
            : "border-gold/40 bg-gold/10"
        }`}
      >
        <span aria-hidden className="text-sm text-gold-deep">
          ⚑
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-gold-deep">
          Violation flagged · {statuteLabel}
        </span>
      </div>

      <div aria-hidden className="mt-5 space-y-4">
        {TURNS.map((t, i) => {
          const local = Math.min(1, Math.max(0, (progress - i / n) / (1 / n)));
          const opacity = 0.3 + 0.7 * local;
          const isHead = progress < 1 && progress >= i / n && progress < (i + 1) / n;
          const { labelCls, barCls } = toneClasses(t.tone);
          return (
            <div
              key={i}
              style={{ opacity }}
              className={`border-l-2 pl-3 transition-colors duration-200 ${
                isHead ? "border-gold" : "border-transparent"
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${labelCls}`}
              >
                {t.label}
              </p>
              <div className="mt-2 space-y-1.5">
                {t.widths.map((w, j) => (
                  <span key={j} className={`block h-2.5 rounded-full ${barCls} ${w}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
