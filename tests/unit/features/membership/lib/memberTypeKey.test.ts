// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  memberTypeInUseMessage,
  memberTypeInUseError,
} from "@/features/membership/lib/memberTypeErrors";
import {
  keyFromLabel,
  MemberTypeKeySchema,
  type MemberTypeKey,
} from "@/features/membership/lib/memberTypeKey";

describe("keyFromLabel", () => {
  it('turns "Current Attendee" into current-attendee', () => {
    expect(keyFromLabel("Current Attendee", [])).toBe("current-attendee");
  });

  it('appends -2 when the slug is reserved (label "Admin")', () => {
    expect(keyFromLabel("Admin", [])).toBe("admin-2");
  });

  it("appends -2 when the base key is already taken", () => {
    const taken: MemberTypeKey[] = [MemberTypeKeySchema.parse("volunteer")];
    expect(keyFromLabel("Volunteer", taken)).toBe("volunteer-2");
  });

  it("uses type-1 for an emoji-only label", () => {
    expect(keyFromLabel("🎉", [])).toBe("type-1");
  });
});

describe("MemberTypeKeySchema", () => {
  it('refuses "Bad Key"', () => {
    expect(MemberTypeKeySchema.safeParse("Bad Key").success).toBe(false);
  });

  it('refuses reserved "admin"', () => {
    expect(MemberTypeKeySchema.safeParse("admin").success).toBe(false);
  });

  it('accepts "current-attendee"', () => {
    expect(MemberTypeKeySchema.safeParse("current-attendee").success).toBe(
      true,
    );
  });
});

describe("memberTypeInUseMessage", () => {
  it("pluralizes members and forms", () => {
    expect(memberTypeInUseMessage(12, 2, "Applicant")).toBe(
      "12 members and 2 forms use Applicant.",
    );
    expect(memberTypeInUseMessage(2, 1, "Helper")).toBe(
      "2 members and 1 form use Helper.",
    );
  });

  it("uses singular labels for one member and one form", () => {
    expect(memberTypeInUseMessage(1, 1, "Volunteer")).toBe(
      "1 member and 1 form use Volunteer.",
    );
  });
});

describe("memberTypeInUseError", () => {
  it("sets reason in_use and carries counts", () => {
    const error = memberTypeInUseError(2, 1, "Helper");
    expect(error.reason).toBe("in_use");
    expect(error.message).toBe("2 members and 1 form use Helper.");
    expect(error.inUse).toEqual({ members: 2, forms: 1, label: "Helper" });
  });
});
