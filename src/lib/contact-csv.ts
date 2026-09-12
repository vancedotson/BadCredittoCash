export type ContactImportField = "name" | "email" | "phone" | "source" | "owner" | "stage";
export type ContactCsv = { headers: string[]; rows: string[][] };
export type ContactColumnMapping = Record<ContactImportField, string>;

export const CONTACT_IMPORT_FIELDS: Array<{ key: ContactImportField; label: string; aliases: string[] }> = [
  { key: "email", label: "Email (required)", aliases: ["email", "email address", "e-mail"] },
  { key: "name", label: "Name", aliases: ["name", "full name", "contact name"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number", "mobile"] },
  { key: "source", label: "Source", aliases: ["source", "lead source"] },
  { key: "owner", label: "Owner", aliases: ["owner", "assigned to"] },
  { key: "stage", label: "Stage", aliases: ["stage", "pipeline stage"] },
];

export function emptyContactMapping(): ContactColumnMapping {
  return { name: "", email: "", phone: "", source: "", owner: "", stage: "" };
}

/** Read complete CSV records, including newlines and escaped quotes inside quoted cells. */
export function parseContactCsv(input: string): ContactCsv {
  const text = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  const endCell = () => { record.push(cell.trim()); cell = ""; closedQuote = false; };
  const endRecord = () => {
    endCell();
    if (record.some((value) => value !== "")) records.push(record);
    record = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === ",") { endCell(); continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endRecord();
      continue;
    }
    if (closedQuote) {
      if (char !== " " && char !== "\t") throw new Error("A CSV value has text after its closing quote. Check the file and try again.");
      continue;
    }
    if (char === '"') {
      if (cell.trim() !== "") throw new Error("A CSV value contains an unexpected quote. Check the file and try again.");
      cell = "";
      quoted = true;
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("A CSV value has an unclosed quote. Check the file and try again.");
  endRecord();
  return { headers: records[0] ?? [], rows: records.slice(1) };
}

export function suggestContactMapping(headers: string[]): ContactColumnMapping {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  const mapping = emptyContactMapping();
  for (const field of CONTACT_IMPORT_FIELDS) {
    const index = normalized.findIndex((header) => field.aliases.includes(header));
    if (index >= 0) mapping[field.key] = String(index);
  }
  return mapping;
}

export function mapContactRows(file: ContactCsv, mapping: ContactColumnMapping): Array<Record<ContactImportField, string>> {
  return file.rows.map((cells) => Object.fromEntries(CONTACT_IMPORT_FIELDS.map((field) => [
    field.key,
    mapping[field.key] === "" ? "" : cells[Number(mapping[field.key])] ?? "",
  ])) as Record<ContactImportField, string>);
}
