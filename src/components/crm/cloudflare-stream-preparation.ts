type StreamPreparationResponse = {
  liveInputId?: unknown;
  error?: unknown;
};

/**
 * Creates one session-scoped, prepare-only request action. Concurrent calls
 * share the in-flight request; a later deliberate call can safely re-prepare.
 * The response's publish and playback URLs are intentionally ignored here.
 */
export function createStreamInputPreparer(sessionId: string, fetcher: typeof fetch) {
  let pending: Promise<string> | null = null;

  return function prepareStreamInput(): Promise<string> {
    if (pending) return pending;

    pending = (async () => {
      const response = await fetcher(`/api/crm/live-webinars/${encodeURIComponent(sessionId)}/stream`, {
        method: "POST",
        cache: "no-store",
        headers: { "x-stream-preparation-only": "1" },
      });
      const result = await response.json().catch(() => null) as StreamPreparationResponse | null;
      if (!response.ok || typeof result?.liveInputId !== "string" || !/^[a-f\d]{32}$/i.test(result.liveInputId)) {
        throw new Error(typeof result?.error === "string" ? result.error : "The Stream input could not be prepared.");
      }
      return result.liveInputId;
    })().finally(() => {
      pending = null;
    });

    return pending;
  };
}
