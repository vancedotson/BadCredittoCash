import { describe, expect, it } from "vitest";
import { decodeReportFileName, isCreditReportBureau, isPdfFile, MAX_CREDIT_REPORT_BYTES, readReportBody } from "./credit-report-validation";

const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF\n");
describe("credit-report input validation", () => {
  it("accepts only the three bureau identifiers", () => {
    expect(["transunion", "equifax", "experian"].every(isCreditReportBureau)).toBe(true);
    expect(isCreditReportBureau("../../other")).toBe(false);
  });
  it("decodes safe PDF names and rejects path/control or malformed names", () => {
    expect(decodeReportFileName(encodeURIComponent("My report.PDF"))).toBe("My report.PDF");
    for (const name of ["../file.pdf", "file\u0000.pdf", "a.png", "x".repeat(181) + ".pdf", "%broken"])
      expect(decodeReportFileName(name)).toBeNull();
  });
  it("requires a PDF header and completed EOF, not just a PDF extension", () => {
    expect(isPdfFile(pdf)).toBe(true);
    expect(isPdfFile(new TextEncoder().encode("image or HTML disguised as a PDF"))).toBe(false);
    expect(isPdfFile(pdf.slice(0, -7))).toBe(false);
  });
  it("enforces the cap on chunked uploads without trusting content-length", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(MAX_CREDIT_REPORT_BYTES)); controller.enqueue(new Uint8Array(1)); },
      cancel() { cancelled = true; },
    });
    const request = new Request("http://localhost/upload", { method: "POST", body, duplex: "half" } as RequestInit);
    expect(await readReportBody(request)).toEqual({ ok: false, status: 413 });
    expect(cancelled).toBe(true);
  });
});
