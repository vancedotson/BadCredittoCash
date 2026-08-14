const block = "animate-pulse rounded-xl border border-mist bg-card";

export default function CrmLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading CRM page">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded bg-mist/70" />
        <div className="h-4 w-72 animate-pulse rounded bg-mist/50" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className={`${block} h-28`} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${block} h-80`} />
        <div className={`${block} h-80`} />
      </div>
      <span className="sr-only">Loading CRM data…</span>
    </div>
  );
}
