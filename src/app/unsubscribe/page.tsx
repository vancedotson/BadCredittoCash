export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const { token, done, error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-cloud px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-mist bg-card p-7 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-trust">Vance Dotson</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-heading">Email preferences</h1>
        {done ? (
          <p className="mt-5 text-body">You&apos;re unsubscribed. We won&apos;t send any more marketing follow-ups.</p>
        ) : error || !token ? (
          <p role="alert" className="mt-5 text-red">This unsubscribe link is invalid. Please use the link from your latest email.</p>
        ) : (
          <>
            <p className="mt-4 text-body">Confirm below to stop marketing and training follow-up emails.</p>
            <p className="mt-2 text-sm text-slate">Necessary appointment and account messages may still be sent.</p>
            <form method="post" action="/api/unsubscribe" className="mt-7">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-ink hover:bg-gold-deep">
                Unsubscribe me
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

