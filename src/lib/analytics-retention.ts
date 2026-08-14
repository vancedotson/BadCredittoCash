import "server-only";

import { createAdminClient } from "./supabase/admin";

export async function cleanupAnonymousAnalytics(batchSize = 500): Promise<{ deleted: number }> {
  const { data, error } = await createAdminClient().rpc("cleanup_anonymous_analytics_v1", {
    p_batch_size: batchSize,
  });
  if (error) throw error;
  return { deleted: typeof data === "number" ? data : 0 };
}
