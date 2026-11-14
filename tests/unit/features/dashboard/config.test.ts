// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemberTypeError } from "@/features/membership/lib/memberTypeErrors";
import { setMemberTypeDashboardLayout } from "@/features/dashboard/server";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import { createOrganization } from "@/tests/unit/testUtils";

const layout: DashboardLayout = {
  layout: "horizontal",
  widgets: [{ id: "notifications", size: "small" }],
};

describe("setMemberTypeDashboardLayout", () => {
  it("rejects layouts for a type the org does not have", async () => {
    const org = await createOrganization(`layout-unknown-${randomUUID()}`, {
      memberTypes: [],
    });

    await expect(
      setMemberTypeDashboardLayout(org.id, "volunteer", layout),
    ).rejects.toBeInstanceOf(MemberTypeError);
  });
});
