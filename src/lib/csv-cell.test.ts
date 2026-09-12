import { describe, expect, it } from "vitest";
import { csvCell } from "./csv-cell";

describe("CSV export of participant text", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1:A2)", "  =1+1", "\t=1+1", "\r=1+1", "\n=1+1", "\uFEFF=1+1"])("neutralizes formula-leading text %j", (value) => {
    const cell = csvCell(value);
    const decoded = cell.startsWith('"') ? cell.slice(1, -1).replaceAll('""', '"') : cell;
    expect(decoded).toBe(`'${value}`);
  });

  it("safely quotes a question containing a formula, comma, and quotes", () => {
    expect(csvCell('=HYPERLINK("https://example.test","open")')).toBe('"\'=HYPERLINK(""https://example.test"",""open"")"');
  });

  it("preserves ordinary multiline questions as a single field", () => {
    expect(csvCell('They said "call us",\r\nwhat should I record?')).toBe('"They said ""call us"",\r\nwhat should I record?"');
    expect(csvCell("How should I document calls?")).toBe("How should I document calls?");
  });

  it("preserves numeric values and empty fields", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});
