/**
 * CSV export for CRM contacts. Pure + client-safe (only reads Contact fields and
 * the label maps), so both the client "export selected" button and the server
 * "export all" route (/api/crm/export) share one implementation.
 */

import type { Contact } from "./store";
import { STAGE_LABELS } from "./stages";
import { SEGMENT_LABELS } from "./segments";

const HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Stage",
  "Segment",
  "Source",
  "Watch %",
  "Booked",
  "Owner",
  "Tags",
  "Created",
  "Last activity",
];

function esc(v: unknown): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(c: Contact): string {
  return [
    c.name,
    c.email,
    c.phone ?? "",
    STAGE_LABELS[c.stage],
    SEGMENT_LABELS[c.segment],
    c.utm?.utm_source ?? c.source ?? "",
    c.watchPct,
    c.booked ? "yes" : "no",
    c.owner ?? "",
    (c.tags ?? []).join(" "),
    c.createdAt.slice(0, 10),
    c.lastActivityAt.slice(0, 10),
  ]
    .map(esc)
    .join(",");
}

export function contactsToCsv(rows: Contact[]): string {
  return [HEADERS.join(","), ...rows.map(row)].join("\n");
}
