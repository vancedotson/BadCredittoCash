import { describe, expect, it } from "vitest";
import { site } from "@/config/site-v3";
import { liveWebinar } from "@/config/live-webinar";
import { SEQUENCES, SEGMENT_SEQUENCES } from "@/config/sequences";
import { LIVE_EMAIL_TEMPLATES } from "@/config/live-sequences";
import { PAYMENT_REQUEST_EMAIL } from "@/config/payment-email-copy";
import { BOOKING_LIFECYCLE_EMAILS } from "@/config/booking-email-copy";
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

  it("keeps outbound email copy free of the word free, the phone number, and the Vance email address", () => {
    const emailCopy = JSON.stringify({
      SEQUENCES,
      SEGMENT_SEQUENCES,
      LIVE_EMAIL_TEMPLATES,
      PAYMENT_REQUEST_EMAIL,
      BOOKING_LIFECYCLE_EMAILS,
    });
    expect(emailCopy).not.toMatch(/\bfree\b/i);
    expect(emailCopy).not.toMatch(PHONE);
    expect(emailCopy).not.toMatch(/\(405\)/);
    expect(emailCopy).not.toMatch(/vancethecreditdoctor/i);
  });
});
