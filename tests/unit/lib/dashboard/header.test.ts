// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveDashboardHeader } from "@/lib/dashboard/header";

describe("resolveDashboardHeader", () => {
  it("uses the entry for the viewer's audience", () => {
    expect(
      resolveDashboardHeader(
        {
          default: { title: "Welcome" },
          attendee: {
            title: "My Camp Dashboard",
            subtitle: "Ready for camp?",
          },
        },
        "attendee",
        "Tiffany Pham",
      ),
    ).toEqual({
      title: "My Camp Dashboard",
      subtitle: "Ready for camp?",
    });
  });

  it("uses the default entry when the audience has no entry", () => {
    expect(
      resolveDashboardHeader(
        { default: { title: "Welcome", location: "Atlanta" } },
        "applicant",
        "Tiffany Pham",
      ),
    ).toEqual({ title: "Welcome", location: "Atlanta" });
  });

  it.each([
    ["admin", "Admin Dashboard"],
    ["member", "Dashboard"],
    ["applicant", "Dashboard"],
    ["attendee", "Dashboard"],
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
        { attendee: { title: "Hi {firstName} — welcome, {firstName}!" } },
        "attendee",
        "  Tiffany   Pham  ",
      ).title,
    ).toBe("Hi Tiffany — welcome, Tiffany!");
  });

  it("does not merge omitted audience fields from the default entry", () => {
    expect(
      resolveDashboardHeader(
        {
          default: { title: "Welcome", description: "Default description" },
          attendee: { subtitle: "Attendee details" },
        },
        "attendee",
        "Tiffany Pham",
      ),
    ).toEqual({ title: "Dashboard", subtitle: "Attendee details" });
  });
});
