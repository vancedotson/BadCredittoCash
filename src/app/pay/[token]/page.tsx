import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { authorizeNetConfigured, authorizeNetEnvironment } from "@/lib/authorize-net-config";
import { findPaymentRequestByToken, type PublicPaymentRequest } from "@/lib/payment-requests";
import { formatUsdCents, isPaymentLinkToken } from "@/lib/payments-display";
import { consumeRateLimitForKey } from "@/lib/public-api";
import { noIndexNofollowMetadata } from "@/lib/route-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment request",
  referrer: "no-referrer",
  ...noIndexNofollowMetadata,
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function paidDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: process.env.BUSINESS_TIMEZONE || "America/Chicago",
  }).format(date);
}

function Shell({ children, sandbox }: { children: React.ReactNode; sandbox: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center bg-cloud px-4 py-12">
      <div className="w-full max-w-md">
        {sandbox ? (
          <p role="note" className="mb-4 rounded-lg border border-gold/40 bg-gold/15 px-4 py-2 text-center text-sm font-semibold text-gold-deep">
            Sandbox test mode. No real charges are made.
          </p>
        ) : null}
        <section className="rounded-2xl border border-mist bg-card p-7 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-trust">Vance Dotson</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">Payment request</h1>
          {children}
        </section>
        <footer className="mt-6 text-center text-sm text-slate">
          <nav aria-label="Legal" className="flex justify-center gap-5">
            <Link className="underline underline-offset-4" href="/privacy">Privacy</Link>
            <Link className="underline underline-offset-4" href="/terms">Terms</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "alert" }) {
  return tone === "alert"
    ? <p role="alert" className="mt-5 rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">{children}</p>
    : <p role="status" className="mt-5 rounded-lg border border-mist bg-cloud px-4 py-3 text-sm text-body">{children}</p>;
}

function Summary({ request }: { request: PublicPaymentRequest }) {
  return (
    <>
      <p className="mt-4 text-body">Hi {request.contactFirstName || "there"},</p>
      <p className="mt-2 break-words text-body">{request.description}</p>
      <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight text-heading">{formatUsdCents(request.amountCents)}</p>
      <p className="mt-1 text-xs text-slate">Reference {request.reference}</p>
    </>
  );
}

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await params;
  if (!isPaymentLinkToken(token)) notFound();
  const query = await searchParams;
  const state = first(query.state);
  const returned = first(query.returned) === "1";

  // Rendered before any database read so the feature stays inert while disabled.
  if (!authorizeNetConfigured()) {
    return (
      <Shell sandbox={false}>
        <p className="mt-5 text-body">Payment links are temporarily unavailable. Please try again later or contact Vance.</p>
      </Shell>
    );
  }
  const sandbox = authorizeNetEnvironment() === "sandbox";

  const requestHeaders = await headers();
  const ip = requestHeaders.get("cf-connecting-ip")
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  let request: PublicPaymentRequest | null = null;
  let rateLimited = false;
  let unavailable = false;
  try {
    if (await consumeRateLimitForKey(`payment-page:${ip}`, "payment", 60, 600)) {
      request = await findPaymentRequestByToken(token);
    } else {
      rateLimited = true;
    }
  } catch {
    unavailable = true;
  }
  if (unavailable) {
    return (
      <Shell sandbox={sandbox}>
        <p className="mt-5 text-body">This page is temporarily unavailable. Please try again in a few minutes.</p>
      </Shell>
    );
  }
  if (rateLimited) {
    return (
      <Shell sandbox={sandbox}>
        <p className="mt-5 text-body">Please try again in a few minutes.</p>
      </Shell>
    );
  }
  if (!request) notFound();

  if (request.status === "paid") {
    return (
      <Shell sandbox={sandbox}>
        <Summary request={request} />
        <Notice>
          Payment received{paidDate(request.paidAt) ? ` on ${paidDate(request.paidAt)}` : ""}
          {request.transactionId ? ` · Transaction ${request.transactionId}` : ""} · Authorize.net emails your receipt.
        </Notice>
      </Shell>
    );
  }
  if (request.status === "cancelled") {
    return (
      <Shell sandbox={sandbox}>
        <Summary request={request} />
        <Notice>This payment request was cancelled. Contact Vance if you still need to pay.</Notice>
      </Shell>
    );
  }
  if (request.held) {
    return (
      <Shell sandbox={sandbox}>
        <Summary request={request} />
        <Notice>Your payment is being reviewed. You will receive an email.</Notice>
      </Shell>
    );
  }
  if (returned) {
    return (
      <Shell sandbox={sandbox}>
        <Summary request={request} />
        <Notice>Thanks. We&apos;re confirming your payment with the card processor. This usually takes a few seconds.</Notice>
        <a
          href={`/api/pay/${token}/return`}
          className="mt-6 block w-full rounded-lg bg-gold px-4 py-2.5 text-center font-semibold text-ink hover:bg-gold-deep"
        >Check again</a>
        <p className="mt-4 text-sm text-slate">
          Didn&apos;t finish paying? <a className="underline underline-offset-4" href={`/pay/${token}`}>Start again</a>.
        </p>
      </Shell>
    );
  }

  return (
    <Shell sandbox={sandbox}>
      <Summary request={request} />
      {request.status === "failed" ? <Notice tone="alert">Your previous card payment was declined. You can try again.</Notice> : null}
      {state === "cancelled" ? <Notice>No payment was made.</Notice> : null}
      {state === "provider-error" ? <Notice tone="alert">We couldn&apos;t start the secure checkout. Please try again in a moment.</Notice> : null}
      {state === "rate-limited" ? <Notice tone="alert">Too many attempts. Please wait a few minutes and try again.</Notice> : null}
      <form method="post" action={`/api/pay/${token}/checkout`} className="mt-7">
        <button type="submit" className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep">
          Pay securely by card
        </button>
      </form>
      <p className="mt-4 text-sm text-slate">
        You will enter your card on Authorize.net&apos;s secure page. Card details never touch this site.
      </p>
    </Shell>
  );
}
