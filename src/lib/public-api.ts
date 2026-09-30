import "server-only";

import { createAdminClient } from "./supabase/admin";

type JsonResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413 };

export async function readLimitedJson<T>(request: Request, maxBytes = 32768): Promise<JsonResult<T>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, status: 413 };
  }

  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { ok: false, status: 400 };
  }
}

function requestIdentity(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return `unknown:${request.headers.get("user-agent") ?? "none"}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type RateLimitBucket = "registration" | "booking" | "tracking" | "live-question" | "live-activity" | "payment";

export async function consumePublicRateLimit(
  request: Request,
  bucket: RateLimitBucket,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  return consumeRateLimitForKey(requestIdentity(request), bucket, limit, windowSeconds);
}

/** Rate limit an explicit identity (for example an IP from headers() or a token hash). Only its hash is stored. */
export async function consumeRateLimitForKey(
  identity: string,
  bucket: RateLimitBucket,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const keyHash = await sha256Hex(`${bucket}:${identity}`);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_key_hash: keyHash,
    p_window_seconds: windowSeconds,
    p_limit: limit,
  });
  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  return data === true;
}
