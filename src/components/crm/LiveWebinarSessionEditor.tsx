"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { draftOf, updateSessionDraft, type SessionDraft } from "@/lib/live-webinar-editor";
import { liveDateToIso } from "@/lib/live-webinar-display";
import { isLivePlayerUrl, isTimezone, type LiveWebinarSession } from "@/lib/live-webinar-types";
import { validateLiveSessionInput } from "@/lib/live-webinar-validation";

const field = "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-mist bg-card px-3 py-2.5 text-base text-body outline-none transition-colors focus:border-trust focus:ring-2 focus:ring-trust/15 disabled:opacity-60 sm:text-sm";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust";
const label = "block text-sm font-medium text-heading";
type IconName = "calendar" | "clock" | "stream" | "replay" | "mail" | "shield" | "chevron";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    stream: <><path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8m-4-1v6" /><circle cx="12" cy="11" r="2" /></>,
    replay: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
  };
  return <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Disclosure({ id, name, description, badge, icon, open, disabled, onToggle, children }: { id: string; name: string; description: string; badge: string; icon: IconName; open: boolean; disabled: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="overflow-hidden rounded-xl border border-mist">
    <h3><button type="button" aria-label={name} aria-expanded={open} aria-controls={id} onClick={onToggle} disabled={disabled} className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-cloud disabled:opacity-60 ${focus}`}>
      <span className="text-heading"><Icon name={icon} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-heading">{name}</span><span className="mt-1 block text-xs font-normal leading-relaxed text-slate">{description}</span></span>
      <span className="hidden text-xs font-normal text-slate sm:block">{badge}</span>
      <Icon name="chevron" className={`h-4 w-4 text-slate transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
    </button></h3>
    <div id={id} hidden={!open} data-editor-section={id} className="space-y-4 border-t border-mist p-4">{children}</div>
  </section>;
}

function SessionSummary({ draft, siteEnabled }: { draft: SessionDraft; siteEnabled: boolean }) {
  let dateLabel = "Choose a start date";
  let timeLabel = "Set the start and end time";
  let month = "DATE";
  let day = "—";
  try {
    const start = new Date(liveDateToIso(draft.startsAt, draft.timezone));
    const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: draft.timezone, ...options }).format(start);
    month = format({ month: "short" }).toUpperCase();
    day = format({ day: "numeric" });
    dateLabel = format({ weekday: "short", month: "long", day: "numeric", year: "numeric" });
    timeLabel = format({ hour: "numeric", minute: "2-digit" });
    const end = new Date(liveDateToIso(draft.endsAt, draft.timezone));
    const endIsSameDay = draft.startsAt.slice(0, 10) === draft.endsAt.slice(0, 10);
    timeLabel += ` – ${new Intl.DateTimeFormat("en-US", { timeZone: draft.timezone, ...(!endIsSameDay ? { month: "short", day: "numeric" } as const : {}), hour: "numeric", minute: "2-digit" }).format(end)}`;
  } catch { /* Incomplete or ambiguous dates are explained on submission. */ }
  return <aside aria-label="Session summary" className="hidden self-start rounded-xl border border-mist/70 bg-cloud p-6 lg:block">
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate">Session summary</p>
    <div className="mt-6 flex items-start gap-4">
      <div className="w-14 shrink-0 overflow-hidden rounded-lg border border-mist bg-card text-center shadow-sm"><div className="bg-gold py-1 text-[10px] font-bold tracking-wider text-ink">{month}</div><div className="py-1.5 text-2xl font-bold tabular-nums text-heading">{day}</div></div>
      <p className="min-w-0 break-words pt-1 text-lg font-semibold leading-snug text-heading">{draft.title.trim() || "Your next live webinar"}</p>
    </div>
    <div className="mt-6 space-y-4 text-xs leading-relaxed text-slate">
      <p className="flex items-start gap-3"><Icon name="calendar" />{dateLabel}</p>
      <p className="flex items-start gap-3"><Icon name="clock" />{timeLabel}</p>
      <p className="pl-8 break-words">{draft.timezone || "Choose a timezone"}</p>
    </div>
    <div className="mt-6 space-y-4 border-t border-mist pt-6 text-xs leading-relaxed text-slate">
      <p className="flex items-start gap-3"><Icon name="shield" />{draft.status === "draft" ? "Draft · Registration closed" : draft.status === "cancelled" ? "Cancelled · Registration closed" : siteEnabled ? "Scheduled" : "Scheduled · Site paused"}</p>
      <p className="flex items-start gap-3"><Icon name="mail" /><span>Session emails {draft.automationEnabled ? "enabled" : "off"}{draft.automationEnabled && !siteEnabled ? <span className="mt-1 block">Site delivery is paused</span> : null}</span></p>
      <p className="flex items-start gap-3"><Icon name="replay" />Replay {draft.replayPublished ? "marked for publication" : "unpublished"}</p>
    </div>
    <p className="mt-7 text-xs leading-relaxed text-slate">{draft.id ? "Changes apply to this session and its registrants." : "You can add your stream and replay later."}</p>
  </aside>;
}

export function LiveWebinarSessionEditor({ session, date, timezone, siteEnabled, onClose, onSaved }: { session: LiveWebinarSession | null; date?: string; timezone: string; siteEnabled: boolean; onClose: () => void; onSaved: (session: LiveWebinarSession) => void }) {
  const [draft, setDraft] = useState(() => draftOf(session, date, timezone));
  const [manualSlug, setManualSlug] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string>();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const title = useRef<HTMLInputElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  const saving = useRef(false);
  const update = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => setDraft((current) => updateSessionDraft(current, key, value, manualSlug));
  const invalid = (name: string) => ({ "aria-invalid": errorField === name || undefined, "aria-errormessage": errorField === name ? "webinar-editor-error" : undefined });

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    title.current?.focus();
    return () => { element?.close(); requestAnimationFrame(() => { if (opener?.isConnected) opener.focus(); }); };
  }, []);

  function close() { if (!saving.current) onClose(); }

  function showError(message: string, name?: string) {
    setError(message);
    setErrorField(name);
    if (name === "slug" && !session) setManualSlug(true);
    const control = name ? form.current?.elements.namedItem(name) : null;
    if (control instanceof HTMLElement) {
      const section = control.closest("[data-editor-section]")?.id;
      if (section === "webinar-stream-settings") setStreamOpen(true);
      if (section === "webinar-replay-settings") setReplayOpen(true);
      requestAnimationFrame(() => { control.focus(); control.scrollIntoView({ block: "nearest" }); });
    } else requestAnimationFrame(() => errorMessage.current?.focus());
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    setError(null); setErrorField(undefined);
    // Reveal hidden settings before focusing an invalid input. Native validation
    // alone cannot focus a control inside a collapsed section.
    const invalidControl = Array.from(event.currentTarget.elements).find((element) => (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) && element.willValidate && !element.validity.valid) as HTMLInputElement | HTMLSelectElement | undefined;
    if (invalidControl) { showError(invalidControl.validationMessage, invalidControl.name); return; }
    if (!isTimezone(draft.timezone)) { showError("Enter a valid timezone, such as America/New_York or Europe/Lisbon.", "timezone"); return; }
    const dates: Record<string, string | null> = {};
    for (const key of ["startsAt", "endsAt", "replayAvailableUntil"] as const) {
      try { dates[key] = key === "replayAvailableUntil" && !draft[key] ? null : liveDateToIso(draft[key], draft.timezone); }
      catch (cause) { showError(cause instanceof Error ? cause.message : "Enter a valid date and time.", key); return; }
    }
    const validation = validateLiveSessionInput({ ...draft, ...dates });
    if (!validation.session) {
      const message = validation.error ?? "Check the session details.";
      const name = message.includes("title") ? "title" : message.includes("slug") ? "slug" : message.includes("expiry") ? "replayAvailableUntil" : message.includes("recording") ? "replayUrl" : message.includes("player") ? ((!draft.embedUrl && draft.status === "scheduled") || (draft.embedUrl && !isLivePlayerUrl(draft.embedUrl)) ? "embedUrl" : "replayUrl") : "endsAt";
      showError(message, name); return;
    }
    saving.current = true; setPending(true);
    try {
      const response = await fetch("/api/crm/live-webinars", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: validation.session }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.session) throw new Error(typeof result.error === "string" ? result.error : "The session could not be saved. Please try again.");
      onSaved(result.session);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The session could not be saved.";
      showError(message, !session && message.includes("slug") ? "slug" : undefined);
    } finally { saving.current = false; setPending(false); }
  }

  const saveLabel = session ? "Save session" : draft.status === "draft" ? "Save draft" : draft.status === "scheduled" ? "Create scheduled session" : "Create cancelled session";
  const saveHint = !draft.automationEnabled ? (draft.status === "draft" ? "Save as a draft. Session emails stay off." : "Session emails stay off.") : !siteEnabled ? "Session emails enabled. Site delivery is paused." : draft.status === "draft" ? "Drafts stay private. Schedule to allow session emails." : draft.status === "cancelled" ? "Eligible cancellation updates may be sent." : "Eligible session emails can be sent after saving.";

  return <dialog ref={dialog} aria-labelledby="webinar-editor-title" aria-describedby="webinar-editor-description" onCancel={(event) => { event.preventDefault(); close(); }} className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[1040px] overflow-hidden rounded-2xl border border-mist bg-card p-0 text-body shadow-2xl backdrop:bg-navy/50 sm:max-h-[92dvh]">
    <form ref={form} onSubmit={submit} noValidate aria-busy={pending} aria-label={session ? "Edit live webinar" : "Create live webinar"} className="flex max-h-[calc(100dvh-1.5rem)] flex-col sm:max-h-[92dvh]">
      <header className="flex shrink-0 items-start gap-3 border-b border-mist px-5 py-5 sm:gap-4 sm:border-0 sm:px-8 sm:py-7">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold-deep sm:flex"><Icon name="calendar" className="h-7 w-7" /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 id="webinar-editor-title" className="text-xl font-bold tracking-tight text-heading sm:text-2xl">{session ? "Edit session" : "New live webinar"}</h2><span className="rounded-full border border-mist bg-cloud px-2.5 py-0.5 text-[11px] font-medium capitalize text-slate">{draft.status}</span></div><p id="webinar-editor-description" className="mt-1.5 text-xs leading-relaxed text-slate sm:text-sm">{session ? "Update this session. Its registrations and history stay together." : "Start with the essentials. Add the rest when you’re ready."}</p></div>
        <button type="button" aria-label="Close session editor" onClick={close} disabled={pending} className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-2xl text-slate hover:bg-cloud disabled:opacity-50 ${focus}`}>×</button>
      </header>

      <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:pb-7 sm:pt-1">
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_290px]">
          <fieldset disabled={pending} className="min-w-0 space-y-6">
            <legend className="sr-only">Session settings</legend>
            <section aria-labelledby="webinar-details-heading">
              <h3 id="webinar-details-heading" className="mb-4 text-base font-semibold text-heading">Session details</h3>
              <label className={label} htmlFor="webinar-title">Title</label>
              <input ref={title} id="webinar-title" name="title" required minLength={3} maxLength={160} value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. September credit workshop" className={field} {...invalid("title")} />
              <div className="mt-4"><label htmlFor="webinar-slug" className="text-xs font-medium text-slate">Session URL name</label><div className="mt-1 flex items-center gap-2">
                <input id="webinar-slug" name="slug" required disabled={Boolean(session)} readOnly={!session && !manualSlug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} value={draft.slug} onChange={(event) => update("slug", event.target.value)} aria-describedby="webinar-slug-hint" placeholder="Generated from your title and date" className={manualSlug ? `${field} mt-0` : "min-h-9 w-full min-w-0 rounded border border-transparent bg-transparent px-0 text-sm text-slate outline-none focus:border-trust disabled:opacity-70"} {...invalid("slug")} />
                {!session && !manualSlug ? <button type="button" aria-label="Edit session URL name" onClick={() => { setManualSlug(true); requestAnimationFrame(() => (form.current?.elements.namedItem("slug") as HTMLInputElement)?.focus()); }} className={`shrink-0 rounded px-2 py-2 text-xs font-semibold text-trust dark:text-gold-deep hover:bg-cloud ${focus}`}>Edit</button> : null}
              </div><p id="webinar-slug-hint" className="mt-1 text-[11px] leading-relaxed text-slate">{session ? "Fixed to keep existing links working." : manualSlug ? "Use lowercase letters, numbers, and hyphens. Your custom name will stay fixed." : "The date helps distinguish repeated sessions. You can edit this name."}</p></div>
            </section>

            <section aria-labelledby="webinar-schedule-heading" className="border-t border-mist pt-5">
              <h3 id="webinar-schedule-heading" className="mb-4 text-base font-semibold text-heading">When is it happening?</h3>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0"><label htmlFor="webinar-start" className={label}>Starts at</label><input id="webinar-start" name="startsAt" type="datetime-local" required value={draft.startsAt} onChange={(event) => update("startsAt", event.target.value)} aria-describedby="webinar-timezone-hint" className={field} {...invalid("startsAt")} /></div>
                <div className="min-w-0"><label htmlFor="webinar-end" className={label}>Ends at</label><input id="webinar-end" name="endsAt" type="datetime-local" required value={draft.endsAt} onChange={(event) => update("endsAt", event.target.value)} aria-describedby="webinar-timezone-hint" className={field} {...invalid("endsAt")} /></div>
              </div>
              <div className="mt-4"><label htmlFor="webinar-timezone" className={label}>Timezone</label><input id="webinar-timezone" name="timezone" required list="live-webinar-timezones" value={draft.timezone} onChange={(event) => update("timezone", event.target.value)} aria-describedby="webinar-timezone-hint" className={field} {...invalid("timezone")} /><datalist id="live-webinar-timezones">{["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/Lisbon", "Europe/London", "UTC"].map((zone) => <option key={zone} value={zone} />)}</datalist><p id="webinar-timezone-hint" className="mt-2 text-xs text-slate">All times, including replay expiry, use this timezone.</p></div>
            </section>

            <div className="space-y-3">
              <Disclosure id="webinar-stream-settings" name="Stream & delivery" description="Live player, status and session emails" badge={draft.automationEnabled ? "Emails on" : draft.status === "draft" && !draft.embedUrl ? "Optional" : "Configured"} icon="stream" open={streamOpen} disabled={pending} onToggle={() => setStreamOpen((value) => !value)}>
                <div><label htmlFor="webinar-status" className={label}>Status</label><select id="webinar-status" name="status" value={draft.status} onChange={(event) => update("status", event.target.value as SessionDraft["status"])} aria-describedby="webinar-status-hint" className={field}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></select><p id="webinar-status-hint" className="mt-2 text-xs leading-relaxed text-slate">{draft.status === "draft" ? "Drafts are private. Choose Scheduled when your stream is ready." : draft.status === "scheduled" ? (siteEnabled ? "Registration stays open until this session ends." : "Ready for registration when live webinars are enabled for the site.") : "Cancelling closes registration and stops pending reminders. History is preserved."}</p></div>
                <div><label htmlFor="webinar-stream" className={label}>Live player URL</label><input id="webinar-stream" name="embedUrl" type="url" value={draft.embedUrl} onChange={(event) => update("embedUrl", event.target.value)} placeholder="https://www.youtube.com/embed/…" aria-describedby="webinar-player-hint" className={field} {...invalid("embedUrl")} /><p id="webinar-player-hint" className="mt-2 text-xs leading-relaxed text-slate">YouTube, YouTube privacy-enhanced, or Vimeo embed URL. Required to schedule.</p></div>
                <label className="flex items-start gap-3 rounded-lg border border-mist bg-cloud p-3"><input name="automationEnabled" type="checkbox" checked={draft.automationEnabled} onChange={(event) => update("automationEnabled", event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-trust" /><span className="text-sm font-medium text-heading">Enable session emails<span className="mt-1 block text-xs font-normal leading-relaxed text-slate">Joining details, reminders and eligible follow-up use this schedule.{!siteEnabled ? " Delivery is paused for the site." : " Existing consent and delivery rules apply."}</span></span></label>
              </Disclosure>
              <Disclosure id="webinar-replay-settings" name="Replay settings" description="Add a recording after your session" badge={draft.replayPublished ? "Publish selected" : draft.replayUrl ? "Recording added" : "Optional"} icon="replay" open={replayOpen} disabled={pending} onToggle={() => setReplayOpen((value) => !value)}>
                <div><label htmlFor="webinar-replay" className={label}>Replay player URL</label><input id="webinar-replay" name="replayUrl" type="url" value={draft.replayUrl} onChange={(event) => update("replayUrl", event.target.value)} placeholder="https://www.youtube.com/embed/…" aria-describedby="webinar-replay-hint" className={field} {...invalid("replayUrl")} /><p id="webinar-replay-hint" className="mt-2 text-xs leading-relaxed text-slate">Use a supported YouTube or Vimeo embed URL.</p></div>
                <div><label htmlFor="webinar-expiry" className={label}>Available until (optional)</label><input id="webinar-expiry" name="replayAvailableUntil" type="datetime-local" value={draft.replayAvailableUntil} onChange={(event) => update("replayAvailableUntil", event.target.value)} aria-describedby="webinar-expiry-hint" className={field} {...invalid("replayAvailableUntil")} /><p id="webinar-expiry-hint" className="mt-2 text-xs text-slate">Leave blank for no expiry. Uses {draft.timezone || "the session timezone"}.</p></div>
                <label className="flex items-start gap-3 text-sm text-heading"><input name="replayPublished" aria-label="Publish replay" aria-describedby="webinar-publication-hint" type="checkbox" checked={draft.replayPublished} onChange={(event) => update("replayPublished", event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-trust" /><span>Publish replay<span id="webinar-publication-hint" className="mt-1 block text-xs leading-relaxed text-slate">Available after a scheduled session ends, while the site is enabled and the replay has not expired.</span></span></label>
              </Disclosure>
            </div>
            {session?.status === "scheduled" ? <p className="rounded-lg border border-mist bg-cloud p-3 text-xs leading-relaxed text-slate">Changing these dates postpones this same session for its registrants. Use a new session for a separate webinar.</p> : null}
          </fieldset>
          <SessionSummary draft={draft} siteEnabled={siteEnabled} />
        </div>
      </div>

      <footer className="shrink-0 border-t border-mist bg-card px-5 py-4 sm:px-8 sm:py-5">
        {error ? <p ref={errorMessage} id="webinar-editor-error" role="alert" tabIndex={-1} className="mb-3 rounded-lg border border-red/20 bg-red/5 px-3 py-2 text-sm text-red outline-none">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex w-full items-start gap-2 text-[11px] leading-relaxed text-slate sm:max-w-[45%] sm:flex-1 sm:text-xs"><Icon name="shield" className="h-4 w-4" />{saveHint}</p>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto"><button type="button" onClick={close} disabled={pending} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium text-slate hover:bg-cloud disabled:opacity-50 ${focus}`}>Discard changes</button><button type="submit" disabled={pending} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-3 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold/85 disabled:opacity-50 sm:flex-none ${focus}`}>{pending ? "Saving…" : saveLabel}<span aria-hidden="true">→</span></button></div>
        </div>
      </footer>
    </form>
  </dialog>;
}
