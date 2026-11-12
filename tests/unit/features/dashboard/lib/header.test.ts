// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DashboardHeaderConfigSchema,
  resolveDashboardHeader,
} from "@/features/dashboard/lib/header";
import { audienceIfCurrent } from "@/features/membership/lib/audience";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";

const volunteer = MemberTypeKeySchema.parse("volunteer");

describe("DashboardHeaderConfigSchema", () => {
  it("parses a pre-Sprint-5 row unchanged", () => {
    const config = {
      applicant: { title: "Hello" },
      attendee: { subtitle: "Camp" },
    };
    expect(DashboardHeaderConfigSchema.parse(config)).toEqual(config);
  });
});

describe("resolveDashboardHeader", () => {
  it("uses the entry for the viewer's audience", () => {
    expect(
      resolveDashboardHeader(
        {
          default: { title: "Welcome" },
          [volunteer]: {
            title: "Volunteer Dashboard",
            subtitle: "Thanks for serving",
          },
        },
        volunteer,
        "Tiffany Pham",
      ),
    ).toEqual({
      title: "Volunteer Dashboard",
      subtitle: "Thanks for serving",
    });
  });

  it("uses the default entry when the audience has no entry", () => {
    expect(
      resolveDashboardHeader(
        { default: { title: "Welcome", location: "Atlanta" } },
        volunteer,
        "Tiffany Pham",
      ),
    ).toEqual({ title: "Welcome", location: "Atlanta" });
  });

  it("ignores a type entry when that key is not current", () => {
    expect(
      resolveDashboardHeader(
        {
          default: { title: "Welcome" },
          [volunteer]: { title: "Volunteer Dashboard" },
        },
        audienceIfCurrent(volunteer, []),
        "Tiffany Pham",
      ),
    ).toEqual({ title: "Welcome" });
  });

  it.each([
    ["admin", "Admin Dashboard"],
    ["member", "Dashboard"],
    [volunteer, "Dashboard"],
  ] as const)(
    "uses the built-in heading for the %s audience",
    (audience, title) => {
      expect(resolveDashboardHeader({}, audience, "Tiffany Pham")).toEqual({
        title,
      });
    },
  );

  it("replaces every first-name placeholder in the title", () => {
    expect(
      resolveDashboardHeader(
        { [volunteer]: { title: "Hi {firstName} — welcome, {firstName}!" } },
        volunteer,
        "  Tiffany   Pham  ",
      ).title,
    ).toBe("Hi Tiffany — welcome, Tiffany!");
  });

  it("does not merge omitted audience fields from the default entry", () => {
    expect(
      resolveDashboardHeader(
        {
          default: { title: "Welcome", description: "Default description" },
          [volunteer]: { subtitle: "Volunteer details" },
        },
        volunteer,
        "Tiffany Pham",
      ),
    ).toEqual({ title: "Dashboard", subtitle: "Volunteer details" });
  });
});
