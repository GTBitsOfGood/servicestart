// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DashboardHeaderConfigSchema } from "@/lib/dashboard/header";
import { OrganizationFooterSchema } from "@/lib/footer";
import { NavbarConfigSchema } from "@/lib/navbar";

describe("DashboardHeaderConfigSchema", () => {
  it("accepts a header per audience", () => {
    const config = {
      default: { title: "Dashboard" },
      applicant: { title: "Hello, {firstName}!", subtitle: "Track it here." },
      attendee: {
        title: "My Camp Dashboard",
        location: "456 Peachtree Avenue, Atlanta, GA 30332",
        dates: "June 2 – Aug 20",
        schedule: "Mon & Wed | 10 AM – 5 PM",
        description: "Ready for camp?",
      },
    };
    expect(DashboardHeaderConfigSchema.parse(config)).toEqual(config);
  });

  it.each([
    ["an unknown audience", { volunteer: { title: "Hi" } }],
    ["an unknown field", { default: { banner: "x" } }],
    ["a blank title", { default: { title: "  " } }],
    ["a title that's too long", { default: { title: "x".repeat(121) } }],
  ])("rejects %s", (_, config) => {
    expect(DashboardHeaderConfigSchema.safeParse(config).success).toBe(false);
  });
});

describe("OrganizationFooterSchema", () => {
  it("accepts contact details and social links", () => {
    const footer = {
      email: "visionariesttt19@gmail.com",
      ein: "84-4516921",
      phone: "(404) 555-0123",
      address: "Atlanta, GA",
      socialLinks: [
        { platform: "instagram", url: "https://instagram.com/visionaries" },
      ],
    };
    expect(OrganizationFooterSchema.parse(footer)).toEqual(footer);
  });

  it.each([
    ["a bad email", { email: "not-an-email" }],
    ["a bad EIN", { ein: "844516921" }],
    [
      "an unknown platform",
      { socialLinks: [{ platform: "myspace", url: "https://myspace.com" }] },
    ],
    [
      "a javascript: link",
      { socialLinks: [{ platform: "website", url: "javascript:alert(1)" }] },
    ],
  ])("rejects %s", (_, footer) => {
    expect(OrganizationFooterSchema.safeParse(footer).success).toBe(false);
  });
});

describe("NavbarConfigSchema", () => {
  it("hides and renames navbar items per audience", () => {
    const config = {
      applicant: { hidden: ["/events"], labels: { "/": "My Application" } },
      attendee: { labels: { "/": "My Camp" } },
    };
    expect(NavbarConfigSchema.parse(config)).toEqual(config);
  });

  it.each([
    ["admins", { admin: { hidden: ["/events"] } }],
    ["an href that isn't a navbar item", { applicant: { hidden: ["/nope"] } }],
    ["a blank label", { attendee: { labels: { "/": " " } } }],
  ])("rejects config for %s", (_, config) => {
    expect(NavbarConfigSchema.safeParse(config).success).toBe(false);
  });
});
