// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  getDashboardAudience,
  memberTypeFromAudience,
} from "@/features/membership/lib/audience";
import { getWidgetOptions } from "@/features/dashboard/widgets";
import { OrganizationConfigKey } from "@/core/db/schema";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

const volunteer = "volunteer" as MemberTypeKey;
const staff = "staff" as MemberTypeKey;
const board = "board" as MemberTypeKey;

describe("getDashboardAudience", () => {
  it.each([
    ["an owner", "owner", volunteer, true, "admin"],
    ["an admin", "admin", null, true, "admin"],
    ["a volunteer", "member", volunteer, true, volunteer],
    ["staff", "member", staff, true, staff],
    ["board", "member", board, true, board],
    ["an untyped member", "member", null, true, "member"],
    ["a volunteer while types are off", "member", volunteer, false, "member"],
  ] as const)(
    "puts %s in the expected audience",
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

describe("memberTypeFromAudience", () => {
  it.each([
    [volunteer, volunteer],
    ["member", null],
    ["admin", null],
  ] as const)("maps %s to %s", (audience, memberType) => {
    expect(memberTypeFromAudience(audience)).toBe(memberType);
  });
});
