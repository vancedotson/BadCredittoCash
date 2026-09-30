import { describe, expect, it } from "vitest";
import { site } from "@/config/site-v3";
import { liveWebinar } from "@/config/live-webinar";
import {
  creditCheckPageMetadata,
  bookPageMetadata,
  homePageMetadata,
  livePageMetadata,
} from "@/lib/route-metadata";

const PHONE = /406-7323|4054067323/;
const EMAIL = /vancethecreditdoctor|mailto:/i;

describe("public visitor-facing copy", () => {
  it("exposes no phone number or email address in public site config", () => {
    const publicCopy = JSON.stringify({ site, liveWebinar });
    expect(publicCopy).not.toMatch(PHONE);
    expect(publicCopy).not.toMatch(EMAIL);
    expect(Object.keys(site.contact).sort()).toEqual(["officeAddress", "officeCity"]);
    expect(site.footer.links.map((link) => link.label)).toEqual(["Privacy", "Terms"]);
  });

  it("does not use the word free in public copy or route metadata", () => {
    const publicCopy = JSON.stringify({
      site,
      liveWebinar,
      metadata: [homePageMetadata, creditCheckPageMetadata, bookPageMetadata, livePageMetadata],
    });
    expect(publicCopy).not.toMatch(/\bfree\b/i);
  });
});
