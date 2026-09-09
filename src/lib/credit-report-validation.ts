export const CREDIT_REPORT_BUREAUS = ["transunion", "equifax", "experian"] as const;
export type CreditReportBureau = typeof CREDIT_REPORT_BUREAUS[number];
export const MAX_CREDIT_REPORT_BYTES = 15 * 1024 * 1024;

export function isCreditReportBureau(value: string): value is CreditReportBureau {
  return (CREDIT_REPORT_BUREAUS as readonly string[]).includes(value);
}

export function decodeReportFileName(value: string | null): string | null {
  if (!value || value.length > 1500) return null;
  try {
    const name = decodeURIComponent(value).trim();
    if (name.length < 5 || name.length > 180 || !/\.pdf$/i.test(name) || /[\x00-\x1f\x7f/\\]/.test(name)) return null;
    return name;
  } catch { return null; }
}

/** Basic file-format checks only; this does not verify the report's contents. */
export function isPdfFile(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || bytes.length > MAX_CREDIT_REPORT_BYTES) return false;
  const header = new TextDecoder().decode(bytes.subarray(0, 16));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  return /^%PDF-(1\.[0-7]|2\.0)(?:\r|\n|\s)/.test(header) && /%%EOF\s*$/.test(tail);
}

export async function readReportBody(request: Request): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; status: 400 | 413 }> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_CREDIT_REPORT_BYTES) return { ok: false, status: 413 };
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_CREDIT_REPORT_BYTES) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { ok: true, bytes };
}
