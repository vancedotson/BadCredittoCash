"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { Tone } from "@/lib/stages";
import {
  CHARGE_UNKNOWN_MESSAGE,
  PAYMENT_DESCRIPTION_MAX,
  PAYMENT_STATUS_LABELS,
  containsCardNumber,
  formatUsdCents,
  interpretChargeResponse,
  isUnresolvedCharge,
  normalizePaymentDescription,
  parseUsdToCents,
  type ChargeOutcome,
  type PaymentRequestItem,
} from "@/lib/payments-display";
import type { AcceptUiResponse } from "@/types/accept-ui";
import { Badge } from "./ui";

type Item = PaymentRequestItem & { link: string };
type PanelData = {
  enabled: boolean;
  demo?: boolean;
  environment: "sandbox" | "production" | null;
  emailSuppressed: boolean;
  /** Present only for signed-in users who can charge, while payments are enabled. */
  acceptUi?: { scriptUrl: string; apiLoginId: string; clientKey: string };
  items: Item[];
};
type ChargeStep = "idle" | "confirm" | "card";
type ChargeResult = { outcome: ChargeOutcome; reason: string | null; transactionId: string | null; cardLast4: string | null; itemId: string | null; amount: string };
const OPAQUE_DESCRIPTOR = "COMMON.ACCEPT.INAPP.PAYMENT";
type PanelState = { data: PanelData | null; error: string; loading: boolean };

const buttonClass = "inline-flex min-h-10 items-center rounded-md border border-mist px-3 py-1.5 text-xs font-medium text-body hover:border-trust focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:opacity-50 dark:focus-visible:outline-gold";
const inputClass = "mt-1 w-full rounded-md border border-mist bg-card px-3 py-2 text-sm text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust dark:focus-visible:outline-gold";

function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function isHeld(item: Item): boolean {
  return Boolean(item.heldTransactionId) && (item.status === "open" || item.status === "failed");
}

function isCharge(item: Item): boolean {
  return item.kind === "charge";
}

/** Hosted-link requests only; a card charge has no client link to copy or email. */
function isPayable(item: Item): boolean {
  return !isCharge(item) && (item.status === "open" || item.status === "failed") && !item.heldTransactionId;
}

/** An open charge is one whose outcome is not known yet (or is under review). */
function isOpenCharge(item: Item): boolean {
  return isCharge(item) && item.status === "open";
}

function statusBadge(item: Item): { tone: Tone; label: string } {
  if (isHeld(item)) return { tone: "warn", label: "Under review" };
  if (isUnresolvedCharge(item)) return { tone: "warn", label: "Result unknown" };
  const tones: Record<Item["status"], Tone> = { open: "info", paid: "success", cancelled: "neutral", failed: "danger" };
  return { tone: tones[item.status], label: PAYMENT_STATUS_LABELS[item.status] };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; } catch { return {}; }
}

export function PaymentRequestsPanel({
  contactId,
  contactEmail,
  contactName,
  demo = false,
  canWrite,
}: {
  contactId: string;
  contactEmail: string;
  contactName?: string;
  demo?: boolean;
  canWrite: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PanelState>({ data: null, error: "", loading: !demo });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [sendEmail, setSendEmail] = useState<boolean | null>(null);
  const [chargeStep, setChargeStep] = useState<ChargeStep>("idle");
  const [draft, setDraft] = useState({ amount: "", description: "" });
  const [draftError, setDraftError] = useState("");
  const [scriptRequested, setScriptRequested] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);
  const cardButtonRef = useRef<HTMLButtonElement>(null);
  const launchedRef = useRef(false);
  const chargingRef = useRef(false);
  const submitRef = useRef<(response: AcceptUiResponse) => void>(() => {});

  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/crm/contact/${encodeURIComponent(contactId)}/payment-requests`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await readJson(response);
        if (!response.ok || !Array.isArray(payload.items)) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Payment requests could not be loaded.");
        }
        setState({ data: payload as unknown as PanelData, error: "", loading: false });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setState({ data: null, error: cause instanceof Error ? cause.message : "Payment requests could not be loaded.", loading: false });
      });
    return () => controller.abort();
  }, [contactId, demo, attempt]);

  const endpoint = `/api/crm/contact/${encodeURIComponent(contactId)}/payment-requests`;
  const data = state.data;
  const emailSuppressed = Boolean(data?.emailSuppressed);
  const emailChecked = sendEmail ?? !emailSuppressed;
  /**
   * The database blocks new charges while any open charge lacks a definite
   * failure; past the two-minute window (or once marked unknown) it is shown here.
   * Wrapped so Array#find's index is never passed as isUnresolvedCharge's `now`.
   */
  const unresolved = data?.items.find((item) => isUnresolvedCharge(item)) ?? null;

  function refresh() { setAttempt((previous) => previous + 1); }

  const chargeAmountCents = parseUsdToCents(draft.amount);

  function startCharge() {
    setNotice(""); setActionError(""); setChargeResult(null);
    if (unresolved) { setDraftError(`Resolve charge ${unresolved.reference} first: use Check status, or cancel it after confirming in Authorize.net that the card was not charged.`); return; }
    if (chargeAmountCents === null) { setDraftError("Enter an amount between $1.00 and $25,000.00 with at most two decimals."); return; }
    const description = normalizePaymentDescription(draft.description);
    if (!description) { setDraftError("Enter a description of 3 to 255 characters."); return; }
    if (containsCardNumber(description)) { setDraftError("The description must not contain a card number."); return; }
    setDraft((previous) => ({ ...previous, description }));
    setDraftError("");
    setChargeStep("confirm");
  }

  function cancelCharge() {
    launchedRef.current = false;
    setChargeStep("idle");
    setDraftError("");
  }

  function openCardForm() {
    // The AcceptUI script only loads after the operator has confirmed the amount.
    setScriptRequested(true);
    launchedRef.current = false;
    setChargeStep("card");
  }

  async function submitCharge(response: AcceptUiResponse) {
    launchedRef.current = false;
    if (chargingRef.current) return;
    const opaque = response.opaqueData;
    if (response.messages?.resultCode !== "Ok" || opaque?.dataDescriptor !== OPAQUE_DESCRIPTOR || !opaque.dataValue) {
      const text = response.messages?.message?.[0]?.text;
      setActionError(`The card could not be validated${text ? `: ${text}` : ""}. Nothing was charged.`);
      return;
    }
    chargingRef.current = true;
    setCharging(true); setNotice(""); setActionError(""); setChargeResult(null);
    try {
      const first = response.customerInformation?.firstName?.trim();
      const last = response.customerInformation?.lastName?.trim();
      const result = await fetch(`${endpoint}/charge`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: draft.amount,
          description: draft.description,
          confirm: true,
          opaqueData: { dataDescriptor: opaque.dataDescriptor, dataValue: opaque.dataValue },
          ...(first || last ? { billTo: { ...(first ? { firstName: first.slice(0, 50) } : {}), ...(last ? { lastName: last.slice(0, 50) } : {}) } } : {}),
        }),
      });
      const payload = await readJson(result);
      // Only the route's own JSON error means nothing was charged; a timeout,
      // gateway error or HTML error page is an unknown outcome.
      const view = interpretChargeResponse(result.ok, payload);
      setChargeStep("idle");
      if (view.kind === "not_charged") {
        setActionError(view.error);
        if (result.status === 409) refresh();
        return;
      }
      setChargeResult({
        outcome: view.outcome, reason: view.reason, transactionId: view.transactionId,
        cardLast4: view.cardLast4, itemId: view.itemId, amount: draft.amount,
      });
      if (view.outcome === "approved") setDraft({ amount: "", description: "" });
      refresh();
    } catch {
      // The request may have reached the server: never assume nothing was charged.
      setChargeStep("idle");
      setChargeResult({
        outcome: "unknown", reason: CHARGE_UNKNOWN_MESSAGE,
        transactionId: null, cardLast4: null, itemId: null, amount: draft.amount,
      });
      refresh();
    } finally {
      chargingRef.current = false;
      setCharging(false);
    }
  }

  useEffect(() => { submitRef.current = submitCharge; });

  // AcceptUI calls a global named by data-responseHandler.
  useEffect(() => {
    window.acceptUiResponseHandler = (response) => submitRef.current(response);
    return () => { delete window.acceptUiResponseHandler; };
  }, []);

  // Open the hosted lightbox once the operator confirmed and the script is ready.
  useEffect(() => {
    if (chargeStep !== "card" || !scriptReady || launchedRef.current) return;
    launchedRef.current = true;
    cardButtonRef.current?.click();
  }, [chargeStep, scriptReady]);

  async function copyLink(link: string) {
    setActionError("");
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Payment link copied.");
    } catch {
      window.prompt("Copy this payment link", link);
    }
  }

  async function create(form: HTMLFormElement) {
    const values = new FormData(form);
    setBusy("create"); setNotice(""); setActionError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: String(values.get("amount") ?? ""),
          description: String(values.get("description") ?? ""),
          sendEmail: emailChecked && !emailSuppressed,
        }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The payment request could not be created.");
      form.reset();
      setSendEmail(null);
      setNotice(typeof payload.emailError === "string"
        ? `Payment request created. ${payload.emailError}`
        : payload.emailOutcome === "sent" ? "Payment request created and emailed."
          : payload.emailOutcome ? "Payment request created. The email is queued." : "Payment request created. Copy the link to share it.");
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The payment request could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function mutate(item: Item, action: "cancel" | "send_email" | "check_status") {
    if (action === "cancel" && !window.confirm(isCharge(item)
      ? `Cancel the ${formatUsdCents(item.amountCents)} charge ${item.reference}? Only do this if you have confirmed in Authorize.net that the card was not charged.`
      : `Cancel the ${formatUsdCents(item.amountCents)} payment request ${item.reference}? The link will stop accepting payment.`)) return;
    setBusy(`${action}:${item.id}`); setNotice(""); setActionError("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, action }),
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "The payment request could not be updated.");
      setNotice(action === "cancel" ? "Payment request cancelled."
        : action === "check_status"
          ? payload.result === "paid" ? "Payment confirmed with Authorize.net."
            : "No approved transaction found yet. If the client may have been charged, wait a minute and check again, or look in the Authorize.net dashboard."
          : payload.emailOutcome === "sent" ? "Payment link emailed." : "Payment link email queued.");
      refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The payment request could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="payments" aria-labelledby="payments-heading" aria-busy={state.loading} className="scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="payments-heading" className="text-lg font-semibold text-heading">Payments</h2>
        {data?.environment === "sandbox" ? <Badge tone="warn">Sandbox test mode: do not send to clients</Badge> : null}
      </div>

      {demo ? (
        <p className="mt-3 rounded-lg border border-mist bg-cloud px-3 py-2 text-sm text-slate">Payment links and card charges are unavailable in demo mode.</p>
      ) : state.loading ? (
        <p className="mt-3 text-sm text-slate" role="status">Loading payment requests…</p>
      ) : state.error ? (
        <div className="mt-3">
          <p className="text-sm text-red dark:text-[#ffb4aa]" role="alert">{state.error}</p>
          <button type="button" className={`${buttonClass} mt-2`} onClick={() => { setState((previous) => ({ ...previous, error: "", loading: true })); refresh(); }}>Try again</button>
        </div>
      ) : !data?.enabled ? (
        <p className="mt-3 text-sm text-slate">Payment links are not enabled.</p>
      ) : (
        <>
          {notice ? <p className="mt-3 text-sm text-green" role="status">{notice}</p> : null}
          {actionError ? <p className="mt-3 text-sm text-red dark:text-[#ffb4aa]" role="alert">{actionError}</p> : null}

          {canWrite ? (
            <form
              className="mt-4 space-y-3 rounded-lg border border-mist p-3"
              onSubmit={(event) => { event.preventDefault(); void create(event.currentTarget); }}
            >
              <h3 className="text-sm font-semibold text-heading">New payment request</h3>
              <label className="block text-xs font-medium text-slate">
                Amount (USD)
                <input name="amount" required inputMode="decimal" autoComplete="off" placeholder="150.00" className={inputClass} />
              </label>
              <label className="block text-xs font-medium text-slate">
                Description (shown to the client and on the receipt)
                <input name="description" required minLength={3} maxLength={PAYMENT_DESCRIPTION_MAX} autoComplete="off" className={inputClass} />
              </label>
              <label className="flex items-start gap-2 text-xs text-body">
                <input
                  type="checkbox"
                  checked={emailChecked && !emailSuppressed}
                  disabled={emailSuppressed}
                  onChange={(event) => setSendEmail(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Email the link to {contactEmail}
                  {emailSuppressed ? <span className="block text-slate">Email is suppressed for this contact. Copy the link instead.</span> : null}
                </span>
              </label>
              <button type="submit" disabled={busy !== null} className={buttonClass}>
                {busy === "create" ? "Creating…" : "Create payment request"}
              </button>
            </form>
          ) : null}

          {canWrite && data.acceptUi ? (
            <section className="mt-4 space-y-3 rounded-lg border border-mist p-3" aria-labelledby="charge-heading">
              <h3 id="charge-heading" className="text-sm font-semibold text-heading">Charge card</h3>
              <p className="text-xs text-slate">
                Charges a card now through Authorize.net&apos;s secure card form. Card details are entered only in that form and never reach this CRM.
                {data.environment === "sandbox" ? " Sandbox: use Authorize.net test cards only." : ""}
              </p>
              {unresolved ? (
                <div role="alert" className="rounded-md border border-mist bg-cloud p-2 text-sm text-body">
                  <p className="font-semibold text-heading">New charges are blocked for this contact</p>
                  <p className="mt-1">
                    The {formatUsdCents(unresolved.amountCents)} charge {unresolved.reference} {isHeld(unresolved) ? "is held for review by Authorize.net" : "has an unknown result"}, so the card may have been charged.
                    Use Check status on it below. Cancel it only after confirming in Authorize.net that the card was not charged.
                  </p>
                </div>
              ) : null}
              {chargeStep === "idle" ? (
                <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); startCharge(); }}>
                  <label className="block text-xs font-medium text-slate">
                    Amount (USD)
                    <input
                      required inputMode="decimal" autoComplete="off" placeholder="150.00" className={inputClass}
                      value={draft.amount} disabled={charging}
                      onChange={(event) => setDraft((previous) => ({ ...previous, amount: event.target.value }))}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate">
                    Description (appears on the receipt)
                    <input
                      required minLength={3} maxLength={PAYMENT_DESCRIPTION_MAX} autoComplete="off" className={inputClass}
                      value={draft.description} disabled={charging}
                      onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
                    />
                  </label>
                  {draftError ? <p className="text-xs text-red dark:text-[#ffb4aa]" role="alert">{draftError}</p> : null}
                  <button type="submit" disabled={busy !== null || charging || unresolved !== null} className={buttonClass}>Charge card…</button>
                </form>
              ) : chargeStep === "confirm" ? (
                <div className="space-y-3" role="group" aria-label="Confirm card charge">
                  <p className="text-sm font-semibold text-heading">
                    Charge {chargeAmountCents === null ? draft.amount : formatUsdCents(chargeAmountCents)} to {contactName ?? contactEmail}?
                  </p>
                  <p className="break-words text-xs text-slate">{draft.description}</p>
                  {data.environment === "sandbox" ? <p className="text-xs text-slate">Sandbox test mode: no real money moves.</p> : (
                    <p className="text-xs text-red dark:text-[#ffb4aa]">This charges a real card immediately.</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={buttonClass} onClick={openCardForm}>Yes, charge now</button>
                    <button type="button" className={buttonClass} onClick={cancelCharge}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2" role="status">
                  <p className="text-sm text-body">
                    Enter the card in the secure form. If it did not open, use Reopen, or reload this page and start again.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={buttonClass} disabled={!scriptReady || charging} onClick={() => cardButtonRef.current?.click()}>
                      {scriptReady ? "Reopen card form" : "Loading secure form…"}
                    </button>
                    <button type="button" className={buttonClass} disabled={charging} onClick={cancelCharge}>Cancel</button>
                  </div>
                </div>
              )}
              {charging ? <p className="text-sm text-body" role="status">Charging the card. Do not close or refresh this page.</p> : null}
              {chargeResult ? (
                <div role="status" className="rounded-md border border-mist bg-cloud p-2 text-sm">
                  {chargeResult.outcome === "approved" ? (
                    <p className="text-green">
                      Approved{parseUsdToCents(chargeResult.amount) !== null ? ` ${formatUsdCents(parseUsdToCents(chargeResult.amount) ?? 0)}` : ""}
                      {chargeResult.transactionId ? ` · Transaction ${chargeResult.transactionId}` : ""}
                      {chargeResult.cardLast4 ? ` · Card ending ${chargeResult.cardLast4}` : ""}
                    </p>
                  ) : chargeResult.outcome === "declined" ? (
                    <p className="text-red dark:text-[#ffb4aa]">Declined{chargeResult.reason ? `: ${chargeResult.reason}` : ""}. Nothing was charged.</p>
                  ) : chargeResult.outcome === "held" ? (
                    <p className="text-body">Held for review by Authorize.net{chargeResult.transactionId ? ` (transaction ${chargeResult.transactionId})` : ""}. Approve or decline it in the Authorize.net dashboard.</p>
                  ) : chargeResult.outcome === "error" ? (
                    <p className="text-red dark:text-[#ffb4aa]">{chargeResult.reason ?? "The charge failed."}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-body">{chargeResult.reason}</p>
                      {(chargeResult.itemId ?? unresolved?.id) ? (
                        <button
                          type="button" className={buttonClass} disabled={busy !== null}
                          onClick={() => {
                            const targetId = chargeResult.itemId ?? unresolved?.id;
                            const target = data.items.find((entry) => entry.id === targetId);
                            if (target) void mutate(target, "check_status"); else refresh();
                          }}
                        >Check status</button>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
              {scriptRequested ? (
                <>
                  <Script
                    id="authorize-net-accept-ui"
                    src={data.acceptUi.scriptUrl}
                    strategy="afterInteractive"
                    charSet="utf-8"
                    onReady={() => setScriptReady(true)}
                    onError={() => { setScriptReady(false); setChargeStep("idle"); setActionError("The secure card form could not be loaded. Nothing was charged."); }}
                  />
                  {/* AcceptUI binds to this button; staff open it through the confirm step above. */}
                  <button
                    ref={cardButtonRef}
                    type="button"
                    hidden
                    tabIndex={-1}
                    className="AcceptUI"
                    data-apiloginid={data.acceptUi.apiLoginId}
                    data-clientkey={data.acceptUi.clientKey}
                    data-billingaddressoptions='{"show":true,"required":false}'
                    data-acceptuiformbtntxt="Charge card"
                    data-acceptuiformheadertxt="Card information"
                    data-responsehandler="acceptUiResponseHandler"
                  >Open secure card form</button>
                </>
              ) : null}
            </section>
          ) : null}

          {data.items.length === 0 ? (
            <p className="mt-4 text-sm text-slate">No payment requests yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.items.map((item) => {
                const badge = statusBadge(item);
                const payable = isPayable(item);
                const openCharge = isOpenCharge(item);
                return (
                  <li key={item.id} className="rounded-lg border border-mist p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-semibold tabular-nums text-heading">{formatUsdCents(item.amountCents)}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{isCharge(item) ? "Card charge" : "Pay link"}</Badge>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </span>
                    </div>
                    <p className="mt-1 break-words text-body">{item.description}</p>
                    <p className="mt-1 text-xs text-slate">
                      {item.reference} · Created {when(item.createdAt)} by {item.createdByName}
                    </p>
                    {item.status === "paid" ? (
                      <p className="mt-1 text-xs text-green">
                        Paid {when(item.paidAt)}{item.transactionId ? ` · Transaction ${item.transactionId}` : ""}
                        {item.cardBrand || item.cardLast4 ? ` · ${[item.cardBrand, item.cardLast4 ? `ending ${item.cardLast4}` : ""].filter(Boolean).join(" ")}` : ""}
                      </p>
                    ) : null}
                    {item.status === "failed" && item.failureReason ? <p className="mt-1 text-xs text-red dark:text-[#ffb4aa]">Last attempt: {item.failureReason}</p> : null}
                    {item.status === "cancelled" ? <p className="mt-1 text-xs text-slate">Cancelled {when(item.cancelledAt)}</p> : null}
                    {item.lastEmail ? (
                      <p className="mt-1 text-xs text-slate">
                        Last email: {item.lastEmail.status}{item.lastEmail.sentAt ? ` ${when(item.lastEmail.sentAt)}` : ""}
                        {item.lastEmail.lastError ? ` · ${item.lastEmail.lastError}` : ""}
                      </p>
                    ) : null}
                    {payable ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className={buttonClass} onClick={() => void copyLink(item.link)}>Copy link</button>
                        {canWrite ? (
                          <>
                            <button
                              type="button"
                              className={buttonClass}
                              disabled={busy !== null || emailSuppressed}
                              title={emailSuppressed ? "Email is suppressed for this contact. Copy the link instead." : undefined}
                              onClick={() => void mutate(item, "send_email")}
                            >{busy === `send_email:${item.id}` ? "Sending…" : item.emailSendCount > 0 ? "Resend link" : "Email link"}</button>
                            <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void mutate(item, "cancel")}>
                              {busy === `cancel:${item.id}` ? "Cancelling…" : "Cancel"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {openCharge && canWrite ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void mutate(item, "check_status")}>
                          {busy === `check_status:${item.id}` ? "Checking…" : "Check status"}
                        </button>
                        <button type="button" className={buttonClass} disabled={busy !== null} onClick={() => void mutate(item, "cancel")}>
                          {busy === `cancel:${item.id}` ? "Cancelling…" : "Cancel"}
                        </button>
                      </div>
                    ) : null}
                    {isHeld(item) ? <p className="mt-1 text-xs text-slate">Authorize.net is reviewing this payment. Approve or decline it in the Authorize.net dashboard.</p> : null}
                    {item.events.length ? (
                      <details className="mt-2 text-xs text-slate">
                        <summary className="cursor-pointer">History</summary>
                        <ul className="mt-1 space-y-0.5">
                          {item.events.map((event, index) => (
                            <li key={`${event.createdAt}-${index}`}>{when(event.createdAt)} · {event.action.replace(/_/g, " ")} · {event.actorName}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
