// The OpenNext worker is generated before Wrangler bundles this entry point.
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  async scheduled(_controller, env, ctx) {
    const response = await handler.fetch(
      new Request("https://vance.internal/api/internal/email-cron", {
        method: "POST",
        headers: { "x-vance-cron-secret": env.CRON_SECRET },
      }),
      env,
      ctx,
    );

    if (!response.ok) {
      console.error("[maintenance-cron] scheduled invocation failed", {
        status: response.status,
      });
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;

// Re-export OpenNext's cache Durable Objects when enabled later.
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
