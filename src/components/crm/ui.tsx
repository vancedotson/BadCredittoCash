import Link from "next/link";
import { STAGE_LABELS, STAGE_TONES, type Stage, type Tone } from "@/lib/stages";
import { SEGMENT_LABELS, type Segment } from "@/lib/segments";
import { type EventIcon } from "@/lib/event-display";
import { type FunnelStage } from "@/lib/store";
import {
  PersonIcon,
  CheckIcon,
  LightbulbIcon,
  PlayIcon,
  ArrowRightIcon,
  PhoneIcon,
  CloseIcon,
  DocumentIcon,
} from "@/components/marketing-v2/Icons";

/** Tone → badge classes (light admin palette; all dark-mode aware via tokens). */
export function toneClass(tone: Tone): string {
  switch (tone) {
    case "info":
      return "bg-sky text-trust";
    case "active":
      return "bg-gold/15 text-gold-deep";
    case "success":
      return "bg-green/12 text-green";
    case "warn":
      return "bg-gold/15 text-gold-deep";
    case "danger":
      return "bg-red/10 text-red";
    default:
      return "bg-mist/60 text-slate";
  }
}

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  return <Badge tone={STAGE_TONES[stage]}>{STAGE_LABELS[stage]}</Badge>;
}

const SEGMENT_TONES: Record<Segment, Tone> = {
  booked: "success",
  booking_abandon: "warn",
  offer_click_no_book: "active",
  high_watch: "active",
  mid_watch: "info",
  low_watch: "neutral",
  registered_no_show: "neutral",
  lead: "neutral",
};

export function SegmentBadge({ segment }: { segment: Segment }) {
  return <Badge tone={SEGMENT_TONES[segment]}>{SEGMENT_LABELS[segment]}</Badge>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-mist bg-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-heading">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate">{subtitle}</p> : null}
    </div>
  );
}

export function KpiTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-mist bg-card p-5">
      <div className="text-3xl font-bold tabular-nums text-heading">{value}</div>
      <div className="mt-1 text-sm text-slate">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-slate/70">{hint}</div> : null}
    </div>
  );
}

const EVENT_ICONS: Record<EventIcon, (p: { className?: string }) => React.ReactElement> = {
  user: PersonIcon,
  check: CheckIcon,
  idea: LightbulbIcon,
  play: PlayIcon,
  cursor: ArrowRightIcon,
  phone: PhoneIcon,
  x: CloseIcon,
  mail: DocumentIcon,
};

export function EventGlyph({ icon, className = "h-4 w-4" }: { icon: EventIcon; className?: string }) {
  const Comp = EVENT_ICONS[icon] ?? CheckIcon;
  return <Comp className={className} />;
}

/** Funnel stage bars (distinct leads per stage), scaled against the first stage. */
export function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.count || 1;
  return (
    <div className="space-y-2">
      {stages.map((s) => {
        const pct = Math.round((s.count / top) * 100);
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div className="w-36 shrink-0 text-sm text-slate">{s.label}</div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-mist/60">
              <div className="h-full rounded-md bg-trust/80" style={{ width: `${Math.max(pct, s.count > 0 ? 4 : 0)}%` }} />
            </div>
            <div className="w-16 shrink-0 text-right text-sm tabular-nums text-body">
              {s.count}
              <span className="ml-1 text-xs text-slate">{pct}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Small link that looks like a table row action. */
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-trust hover:text-heading hover:underline">
      {children}
    </Link>
  );
}
