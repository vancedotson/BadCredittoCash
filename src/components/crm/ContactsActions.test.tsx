import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContactsActions } from "./ContactsActions";

describe("contact header permissions", () => {
  it("offers no write or export actions to a read-only user", () => {
    expect(renderToStaticMarkup(<ContactsActions owners={[]} canWrite={false} canAdmin={false} exportHref="/api/crm/export" />)).toBe("");
  });

  it("offers contact creation to writers while reserving import and export for administrators", () => {
    const html = renderToStaticMarkup(<ContactsActions owners={[]} canWrite canAdmin={false} exportHref="/api/crm/export" />);
    expect(html).toContain("+ Add contact");
    expect(html).not.toContain("Export CSV");
    expect(html).not.toContain("Import CSV");
  });

  it("uses the supplied export URL and waits for hydration before accepting dialog clicks", () => {
    const html = renderToStaticMarkup(<ContactsActions owners={[]} canWrite canAdmin exportHref="/api/crm/export?q=ana" />);
    expect(html).toContain('href="/api/crm/export?q=ana"');
    expect(html).toContain('aria-label="Export all CSV"');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).not.toContain("<dialog");
  });
});
