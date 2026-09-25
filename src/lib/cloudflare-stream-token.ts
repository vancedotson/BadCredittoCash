import "server-only";

const TOKEN_LIFETIME_SECONDS = 15 * 60;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodePrivateJwk(encoded: string): JsonWebKey {
  let json: string;
  try {
    json = atob(encoded);
  } catch {
    throw new Error("Cloudflare Stream playback signing is not configured.");
  }
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Cloudflare Stream playback signing is not configured.");
  }
  return value as JsonWebKey;
}

function configuredPrivateJwk(): JsonWebKey | null {
  const encoded = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK;
  if (!encoded) return null;
  try {
    const jwk = decodePrivateJwk(encoded);
    const required = ["n", "e", "d", "p", "q", "dp", "dq", "qi"] as const;
    return jwk.kty === "RSA" && required.every((key) => typeof jwk[key] === "string" && jwk[key]) ? jwk : null;
  } catch {
    return null;
  }
}

export function cloudflareStreamPlaybackSigningConfigured(): boolean {
  const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
  return Boolean(keyId && /^[A-Za-z0-9_-]{1,128}$/.test(keyId) && configuredPrivateJwk());
}

export async function createCloudflareLivePlaybackUrl(input: {
  endpoint: string;
  liveInputId: string;
  now?: number;
}): Promise<string> {
  const keyId = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID;
  const encodedJwk = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_JWK;
  const privateJwk = configuredPrivateJwk();
  if (!keyId || !/^[A-Za-z0-9_-]{1,128}$/.test(keyId) || !encodedJwk || !privateJwk) throw new Error("Cloudflare Stream playback signing is not configured.");
  if (!/^[a-f\d]{32}$/i.test(input.liveInputId)) throw new Error("Cloudflare Stream returned an invalid live input.");

  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== "https:" || !/^customer-[a-z0-9]+\.cloudflarestream\.com$/i.test(endpoint.hostname)
    || endpoint.pathname !== `/${input.liveInputId}/webRTC/play` || endpoint.search || endpoint.hash) {
    throw new Error("Cloudflare Stream returned an invalid playback endpoint.");
  }

  const now = Math.floor((input.now ?? Date.now()) / 1000);
  const encodedHeader = encodeJson({ alg: "RS256", kid: keyId, typ: "JWT" });
  const encodedPayload = encodeJson({ sub: input.liveInputId, kid: keyId, nbf: now - 30, exp: now + TOKEN_LIFETIME_SECONDS });
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const token = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  endpoint.pathname = `/${token}/webRTC/play`;
  return endpoint.toString();
}
