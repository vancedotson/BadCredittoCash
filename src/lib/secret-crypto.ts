import "server-only";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): ArrayBuffer {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const result = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(result);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return result;
}

async function encryptionKey(): Promise<CryptoKey> {
  const configured = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!configured) throw new Error("Google token encryption is not configured.");
  const raw = base64UrlDecode(configured);
  if (raw.byteLength !== 32) throw new Error("Google token encryption key is invalid.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    encoder.encode(value),
  );
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string): Promise<string> {
  const [ivPart, ciphertextPart] = value.split(".");
  if (!ivPart || !ciphertextPart) throw new Error("Encrypted Google token is invalid.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(ivPart) },
    await encryptionKey(),
    base64UrlDecode(ciphertextPart),
  );
  return decoder.decode(decrypted);
}

export async function signGoogleOAuthState(userId: string): Promise<string> {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    sub: userId,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomUUID(),
  })));
  const key = await crypto.subtle.importKey(
    "raw", base64UrlDecode(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? ""),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyGoogleOAuthState(state: string): Promise<string | null> {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw", base64UrlDecode(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? ""),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC", key, base64UrlDecode(signature), encoder.encode(payload),
    );
    if (!valid) return null;
    const parsed = JSON.parse(decoder.decode(base64UrlDecode(payload))) as { sub?: string; exp?: number };
    return parsed.sub && parsed.exp && parsed.exp >= Date.now() ? parsed.sub : null;
  } catch {
    return null;
  }
}
