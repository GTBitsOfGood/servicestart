// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pruneAudienceRecord } from "@/features/dashboard/lib/audienceRecord";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

const volunteer = "volunteer" as MemberTypeKey;
const staff = "staff" as MemberTypeKey;

describe("pruneAudienceRecord", () => {
  it("keeps reserved audiences and current type keys", () => {
    const record = {
      default: { title: "Welcome" },
      admin: { title: "Admin" },
      member: { title: "Members" },
      [volunteer]: { title: "Volunteers" },
      [staff]: { title: "Staff" },
      retired: { title: "Gone" },
    };

    expect(pruneAudienceRecord(record, [volunteer])).toEqual({
      default: { title: "Welcome" },
      admin: { title: "Admin" },
      member: { title: "Members" },
      [volunteer]: { title: "Volunteers" },
    });
  });
});
