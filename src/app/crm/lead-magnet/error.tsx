"use client";

export default function LeadMagnetError({ retry }: { retry: () => void }) {
  return (
    <section className="rounded-2xl border border-mist bg-card p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-heading">Lead magnet</h1>
      <p role="alert" className="mt-3 text-sm text-slate">Signups and reports couldn’t be loaded. Please try again. If this continues, ask your administrator to check the lead magnet connection.</p>
      <button type="button" onClick={retry} className="mt-5 min-h-11 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust">Try again</button>
    </section>
  );
}
