import { describe, expect, it } from "vitest";
import { emptyContactMapping, mapContactRows, parseContactCsv, suggestContactMapping } from "./contact-csv";

describe("contact CSV parsing", () => {
  it("reads commas, escaped quotes, and multiline cells as complete records", () => {
    expect(parseContactCsv('Name,Email,Source\r\n"Wright, Evan",evan@example.com,"Webinar\r\nSeptember"\r\n"Rosa ""RJ"" Jimenez",rosa@example.com,Email')).toEqual({
      headers: ["Name", "Email", "Source"],
      rows: [["Wright, Evan", "evan@example.com", "Webinar\r\nSeptember"], ['Rosa "RJ" Jimenez', "rosa@example.com", "Email"]],
    });
  });

  it("removes a UTF-8 BOM, trims cells, and ignores blank records", () => {
    expect(parseContactCsv('\uFEFF Email , Name\n\n ana@example.com , Ana \n,\n')).toEqual({ headers: ["Email", "Name"], rows: [["ana@example.com", "Ana"]] });
  });

  it("preserves empty columns and cells while accepting quoted whitespace", () => {
    expect(parseContactCsv('Email,Phone,Name\r"ana@example.com" , ,"Ana"\r')).toEqual({ headers: ["Email", "Phone", "Name"], rows: [["ana@example.com", "", "Ana"]] });
  });

  it("handles empty files and headers without contacts", () => {
    expect(parseContactCsv("\uFEFF\n\r\n")).toEqual({ headers: [], rows: [] });
    expect(parseContactCsv("Name,Email\n")).toEqual({ headers: ["Name", "Email"], rows: [] });
  });

  it.each(['Name,Email\n"Ana,ana@example.com', 'Name,Email\nAna"s,ana@example.com', 'Name,Email\n"Ana"oops,ana@example.com'])("rejects malformed quoting instead of importing shifted data: %s", (text) => {
    expect(() => parseContactCsv(text)).toThrow(/quote/);
  });
});

describe("contact CSV column mapping", () => {
  it("recognizes the existing aliases regardless of capitalization and column order", () => {
    expect(suggestContactMapping(["Pipeline Stage", "E-MAIL", "Full Name", "Assigned To", "Mobile", "Lead Source"])).toEqual({ name: "2", email: "1", phone: "4", source: "5", owner: "3", stage: "0" });
  });

  it("leaves unknown columns unmapped", () => {
    expect(suggestContactMapping(["unrecognized"])).toEqual(emptyContactMapping());
  });

  it("sends only the six existing API fields, with blanks for unmapped or missing values", () => {
    const file = { headers: ["Email", "Name", "Private note"], rows: [["ana@example.com", "Ana", "not imported"], ["grace@example.com"]] };
    expect(mapContactRows(file, suggestContactMapping(file.headers))).toEqual([
      { email: "ana@example.com", name: "Ana", phone: "", source: "", owner: "", stage: "" },
      { email: "grace@example.com", name: "", phone: "", source: "", owner: "", stage: "" },
    ]);
  });
});
