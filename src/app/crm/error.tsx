"use client";

import { useEffect, useState } from "react";

export default function CrmError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error("CRM route error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red/30 bg-card p-6 shadow-sm" role="alert">
      <div className="text-xs font-semibold uppercase tracking-widest text-red">Temporary problem</div>
      <h1 className="mt-2 text-2xl font-bold text-heading">The CRM page couldn&apos;t load</h1>
      <p className="mt-2 text-sm leading-6 text-slate">
        Your data was not changed. This is usually a temporary connection or server issue. Try the request again.
      </p>
      {error.digest ? <p className="mt-3 text-xs text-slate">Reference: {error.digest}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            unstable_retry();
          }}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {retrying ? "Trying again…" : "Try again"}
        </button>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-mist bg-card px-4 py-2 text-sm font-medium text-body hover:border-trust">
          Reload CRM
        </button>
      </div>
    </div>
  );
}
