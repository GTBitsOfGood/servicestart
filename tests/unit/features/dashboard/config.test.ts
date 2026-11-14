// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/core/db";
import {
  memberTypes,
  organizationConfig,
  OrganizationConfigKey,
} from "@/core/db/schema";
import { MemberTypeError } from "@/features/membership/lib/memberTypeErrors";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import {
  getMemberTypeDashboardLayout,
  setMemberTypeDashboardLayout,
} from "@/features/dashboard/server";
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

  it("waits for a concurrent delete instead of saving the deleted type's layout back", async () => {
    const volunteer = MemberTypeKeySchema.parse("volunteer");
    const staff = MemberTypeKeySchema.parse("staff");
    const org = await createOrganization(`layout-race-${randomUUID()}`, {
      memberTypes: [
        { key: volunteer, label: "Volunteer", pluralLabel: "Volunteers" },
        { key: staff, label: "Staff", pluralLabel: "Staff" },
      ],
    });
    await setMemberTypeDashboardLayout(org.id, staff, layout);
    const staffRow = and(
      eq(memberTypes.organizationId, org.id),
      eq(memberTypes.key, staff),
    );

    // A delete of Staff that has locked its row, as MemberTypeService.delete
    // does, and finishes once released.
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let lockTaken!: () => void;
    const locked = new Promise<void>((resolve) => (lockTaken = resolve));
    const deleting = db.transaction(async (tx) => {
      await tx.select().from(memberTypes).where(staffRow).for("update");
      lockTaken();
      await released;
      await tx.delete(memberTypes).where(staffRow);
      await tx
        .update(organizationConfig)
        .set({
          value: sql`(${organizationConfig.value}::jsonb - ${staff}::text)::text`,
        })
        .where(
          and(
            eq(organizationConfig.organizationId, org.id),
            eq(
              organizationConfig.key,
              OrganizationConfigKey.MemberTypeDashboardLayouts,
            ),
          ),
        );
    });
    await locked;

    let saved = false;
    const saving = setMemberTypeDashboardLayout(org.id, volunteer, layout).then(
      () => {
        saved = true;
      },
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(saved).toBe(false);
    } finally {
      release();
      await deleting;
      await saving;
    }
    expect(await getMemberTypeDashboardLayout(org.id, staff)).toBeNull();
    expect(await getMemberTypeDashboardLayout(org.id, volunteer)).toEqual(
      layout,
    );
  });
});
