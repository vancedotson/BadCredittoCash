import Link from "next/link";

export default function ContactNotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-mist bg-card p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-widest text-slate">Contact unavailable</div>
      <h1 className="mt-2 text-2xl font-bold text-heading">This contact no longer exists</h1>
      <p className="mt-2 text-sm leading-6 text-slate">It may have been moved to Trash or permanently deleted in another CRM session.</p>
      <Link href="/crm/contacts" className="mt-5 inline-flex rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink">
        Return to contacts
      </Link>
    </div>
  );
}
