import { SEQUENCES, SEGMENT_SEQUENCES, type Sequence } from "@/config/sequences";
import { SEQUENCE_FOR_SEGMENT } from "@/lib/automations";
import { SEGMENTS_IN_ORDER, type Segment } from "@/lib/segments";
import { getSettings } from "@/lib/store";
import { PageTitle, Card, SegmentBadge } from "@/components/crm/ui";

export const dynamic = "force-dynamic";

const byId: Record<string, Sequence> = { ...SEQUENCES, ...SEGMENT_SEQUENCES };
const GOALS: Record<string, string> = {
  pre_webinar: "Get registrants to actually watch the training.",
  nurture: "Keep non-bookers warm until they're ready to talk.",
  onboarding: "Prep a booked caller so the call is productive.",
  registered_no_show: "Win back people who signed up but never watched.",
  low_watch: "Re-hook people who dropped off in the first few minutes.",
  mid_watch: "Reinforce the method for people who saw the problem, not the fix.",
  high_watch: "Push warm, almost-there watchers to book the call.",
  offer_click_no_book: "Overcome the blocker for people who clicked but didn't book.",
  booking_abandon: "Rescue people who started booking and got interrupted.",
};

// Lifecycle triggers (not segment-driven) + the segment routing map.
const LIFECYCLE = [
  { when: "A contact registers", sequence: "pre_webinar" },
  { when: "A contact books a call", sequence: "onboarding" },
  { when: "Non-buyer, other sequences exhausted", sequence: "nurture" },
];


/** Render a body string with merge tokens highlighted. */
function withTokens(body: string): React.ReactNode[] {
  return body.split(/(\{\{[^}]+\}\})/g).map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part)
      ? <code key={i} className="rounded bg-sky px-1 py-0.5 text-[11px] text-trust">{part}</code>
      : <span key={i}>{part}</span>,
  );
}

function SequenceCard({ seq }: { seq: Sequence }) {
  return (
    <Card>
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="font-heading text-base font-semibold text-heading">{seq.name}</h3>
        <span className="shrink-0 rounded-full bg-mist/70 px-2 py-0.5 text-xs text-slate">{seq.emails.length} email{seq.emails.length === 1 ? "" : "s"}</span>
      </div>
      {GOALS[seq.id] ? <p className="mb-1 text-sm text-body">{GOALS[seq.id]}</p> : null}
      <p className="mb-4 text-xs text-slate">Enrolled: {seq.trigger} · Channel: Email</p>
      <ol className="relative space-y-4 border-l border-mist pl-6">
        {seq.emails.map((em, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[31px] top-0.5 grid h-6 w-6 place-items-center rounded-full bg-trust text-[11px] font-semibold text-white">{i + 1}</span>
            <div className="text-xs font-medium text-trust">{em.delay}</div>
            <div className="mt-1 rounded-lg border border-mist bg-cloud p-3">
              <div className="text-sm font-semibold text-heading">{em.subject}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate">{withTokens(em.body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default async function SequencesPage() {
  const { profile } = await getSettings();
  const mergeFields = [
    { token: "{{watch_link}}", meaning: "The contact's link to the on-demand training.", value: profile.trainingUrl },
    { token: "{{call_link}}", meaning: "The link to book a free strategy call.", value: profile.bookingUrl },
  ];
  const segmentRows = SEGMENTS_IN_ORDER.map((s) => ({ segment: s as Segment, sequence: SEQUENCE_FOR_SEGMENT[s] })).filter((r) => r.sequence);

  return (
    <div className="space-y-8">
      <PageTitle title="Sequences" subtitle="The automated email engine, explained. Delivery is stubbed behind a seam, so nothing actually sends yet." />

      {/* How it works */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-heading">How it works</h2>
        <div className="flex flex-wrap items-stretch gap-2 text-sm">
          {[
            { n: 1, t: "Behavior", d: "A contact registers, watches, clicks, or books." },
            { n: 2, t: "Segment", d: "Their events place them in a segment (or a lifecycle moment)." },
            { n: 3, t: "Enroll", d: "The automation map enrolls them in the matching sequence." },
            { n: 4, t: "Schedule", d: "Its emails queue by their delays (immediately, +1h, +1d…)." },
            { n: 5, t: "Send", d: "Delivery is stubbed. Flip on an ESP later, no UI changes.", stub: true },
          ].map((s, i, arr) => (
            <div key={s.n} className="flex items-stretch gap-2">
              <div className={`w-40 rounded-xl border p-3 ${s.stub ? "border-dashed border-mist bg-cloud/50" : "border-mist bg-cloud"}`}>
                <div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-navy text-[11px] font-semibold text-white">{s.n}</span><span className="font-medium text-heading">{s.t}</span></div>
                <p className="mt-1.5 text-xs text-slate">{s.d}</p>
              </div>
              {i < arr.length - 1 ? <span className="hidden self-center text-slate sm:inline">→</span> : null}
            </div>
          ))}
        </div>
      </Card>

      {/* Behavior → sequence map */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">What triggers each sequence</h2>
          <div className="mb-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">Lifecycle</div>
            <ul className="space-y-1.5 text-sm">
              {LIFECYCLE.map((r) => (
                <li key={r.sequence} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <span className="text-body">{r.when}</span>
                  <span className="text-trust">→ {byId[r.sequence]?.name ?? r.sequence}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">By segment</div>
            <ul className="space-y-1.5 text-sm">
              {segmentRows.map((r) => (
                <li key={r.segment} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <SegmentBadge segment={r.segment} />
                  <span className="text-trust">→ {byId[r.sequence!]?.name ?? r.sequence}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Merge fields */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Merge fields</h2>
          <p className="mb-3 text-sm text-slate">Placeholders in the copy that get filled in per contact when a real ESP is wired. The links come from the business profile in Settings.</p>
          <ul className="space-y-2.5">
            {mergeFields.map((f) => (
              <li key={f.token} className="text-sm">
                <div className="flex items-start gap-3">
                  <code className="shrink-0 rounded bg-sky px-1.5 py-0.5 text-xs text-trust">{f.token}</code>
                  <span className="text-slate">{f.meaning}</span>
                </div>
                <div className="mt-1 truncate pl-1 text-xs text-body">→ {f.value}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg border border-dashed border-mist bg-cloud/50 p-3 text-xs text-slate">Copy is written compliance-safe (no fake countdowns, no guarantees). Content lives in <code>src/config/sequences.ts</code>.</p>
        </Card>
      </div>

      {/* The sequences */}
      {[{ heading: "Core sequences", items: Object.values(SEQUENCES) }, { heading: "Segment follow-up paths", items: Object.values(SEGMENT_SEQUENCES) }].map((g) => (
        <div key={g.heading} className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate">{g.heading}</h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {g.items.map((seq) => <SequenceCard key={seq.id} seq={seq} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
