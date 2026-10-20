// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getDashboardAudience } from "@/lib/dashboard/audience";
import { getWidgetOptions } from "@/lib/dashboard/widgets";
import { MemberType, OrganizationConfigKey } from "@/lib/schema";

describe("getDashboardAudience", () => {
  it.each([
    ["an owner", "owner", MemberType.Applicant, true, "admin"],
    ["an admin", "admin", null, true, "admin"],
    ["an applicant", "member", MemberType.Applicant, true, "applicant"],
    ["an attendee", "member", MemberType.Attendee, true, "attendee"],
    ["an untyped member", "member", null, true, "member"],
    [
      "an applicant while types are off",
      "member",
      MemberType.Applicant,
      false,
      "member",
    ],
    [
      "an attendee while types are off",
      "member",
      MemberType.Attendee,
      false,
      "member",
    ],
  ] as const)(
    "puts %s in the %s audience",
    (_, role, memberType, enabled, expected) => {
      expect(getDashboardAudience({ role, memberType }, enabled)).toBe(
        expected,
      );
    },
  );

  it("treats a missing membership as a member", () => {
    expect(getDashboardAudience(null, true)).toBe("member");
  });
});

describe("getWidgetOptions", () => {
  const formWidgets = [
    "application_status",
    "forms_todo",
    "forms_completed",
    "forms_progress",
  ];

  it("leaves out form widgets while forms are off", () => {
    const ids = getWidgetOptions().map(({ id }) => id);
    expect(ids).toContain("weekly_calendar");
    for (const id of formWidgets) expect(ids).not.toContain(id);
  });

  it("offers form widgets once forms are on", () => {
    const ids = getWidgetOptions({
      [OrganizationConfigKey.FormsEnabled]: true,
    }).map(({ id }) => id);
    for (const id of formWidgets) expect(ids).toContain(id);
  });
});
