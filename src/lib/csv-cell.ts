/** Quote CSV fields and keep untrusted text from becoming spreadsheet formulas. */
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (typeof value === "string" && (/^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r]/.test(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
