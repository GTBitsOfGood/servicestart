// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import db from "@/core/db";
import { members, OrganizationConfigKey, users } from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import {
  getMemberTypeDashboardLayout,
  setMemberTypeDashboardLayout,
} from "@/features/dashboard/server";
import { DEFAULT_MEMBER_LAYOUT } from "@/features/dashboard/lib/constants";
import {
  MemberTypeError,
  memberTypeInUseMessage,
} from "@/features/membership/lib/memberTypeErrors";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { MemberTypeService } from "@/features/membership/server";
import {
  addMember,
  buildTestUser,
  createForm,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

const pgCode = (error: unknown, code: string): boolean => {
  let cause: unknown = error;
  while (cause instanceof Error) {
    if (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === code
    ) {
      return true;
    }
    cause = cause.cause;
  }
  return false;
};

describe("MemberTypeService", () => {
  it("creates, updates, reorders, and deletes member types", async () => {
    const org = await createOrganization(
      `mts-crud-${randomUUID().slice(0, 8)}`,
      {
        memberTypes: [],
      },
    );

    const created = await MemberTypeService.create(org.id, {
      label: "Volunteer",
      pluralLabel: "Volunteers",
    });
    expect(created.key).toBe(MemberTypeKeySchema.parse("volunteer"));
    expect(created.position).toBe(0);

    const second = await MemberTypeService.create(org.id, {
      label: "Board Member",
      pluralLabel: "Board Members",
    });
    expect(second.key).toBe(MemberTypeKeySchema.parse("board-member"));
    expect(second.position).toBe(1);

    const updated = await MemberTypeService.update(org.id, created.key, {
      label: "Helper",
      pluralLabel: "Helpers",
    });
    expect(updated.key).toBe(created.key);
    expect(updated.label).toBe("Helper");

    const reordered = await MemberTypeService.reorder(org.id, [
      second.key,
      created.key,
    ]);
    expect(reordered.map((row) => row.key)).toEqual([second.key, created.key]);
    expect(reordered.map((row) => row.position)).toEqual([0, 1]);

    const beforeDup = await MemberTypeService.list(org.id);
    await expect(
      MemberTypeService.reorder(org.id, [created.key, created.key]),
    ).rejects.toMatchObject({ reason: "invalid" });
    expect(await MemberTypeService.list(org.id)).toEqual(beforeDup);

    await MemberTypeService.delete(org.id, created.key);
    expect(await MemberTypeService.findByKey(org.id, created.key)).toBeNull();
    expect(
      await MemberTypeService.findByKey(org.id, second.key),
    ).not.toBeNull();
  });

  it("ensure is safe to rerun and keeps admin-renamed labels", async () => {
    const org = await createOrganization(
      `mts-ensure-${randomUUID().slice(0, 8)}`,
      { memberTypes: [] },
    );
    const applicant = MemberTypeKeySchema.parse("applicant");
    const attendee = MemberTypeKeySchema.parse("attendee");

    await MemberTypeService.ensure(org.id, {
      key: applicant,
      label: "Applicant",
      pluralLabel: "Applicants",
      isSignupDefault: true,
    });
    await MemberTypeService.ensure(org.id, {
      key: attendee,
      label: "Current Attendee",
      pluralLabel: "Current Attendees",
      isSignupDefault: false,
    });
    await MemberTypeService.update(org.id, applicant, {
      label: "New Applicant",
      pluralLabel: "New Applicants",
    });
    await MemberTypeService.setSignupDefault(org.id, attendee);

    await MemberTypeService.ensure(org.id, {
      key: applicant,
      label: "Applicant",
      pluralLabel: "Applicants",
      isSignupDefault: true,
    });
    await MemberTypeService.ensure(org.id, {
      key: attendee,
      label: "Current Attendee",
      pluralLabel: "Current Attendees",
      isSignupDefault: false,
    });

    const rows = await MemberTypeService.list(org.id);
    expect(rows.find((row) => row.key === applicant)?.label).toBe(
      "New Applicant",
    );
    expect(rows.filter((row) => row.isSignupDefault)).toHaveLength(1);
    expect(rows.find((row) => row.isSignupDefault)?.key).toBe(applicant);
  });

  it("keeps one signup default after two setSignupDefault calls", async () => {
    const org = await createOrganization(
      `mts-default-${randomUUID().slice(0, 8)}`,
      {
        memberTypes: [],
      },
    );
    const a = await MemberTypeService.create(org.id, {
      label: "Type A",
      pluralLabel: "Types A",
    });
    const b = await MemberTypeService.create(org.id, {
      label: "Type B",
      pluralLabel: "Types B",
    });

    await MemberTypeService.setSignupDefault(org.id, a.key);
    await MemberTypeService.setSignupDefault(org.id, b.key);

    const rows = await MemberTypeService.list(org.id);
    expect(rows.filter((row) => row.isSignupDefault)).toHaveLength(1);
    expect(rows.find((row) => row.isSignupDefault)?.key).toBe(b.key);
  });

  it("refuses delete when members and forms use the type", async () => {
    const org = await createOrganization(
      `mts-in-use-${randomUUID().slice(0, 8)}`,
      {
        memberTypes: [],
      },
    );
    const type = await MemberTypeService.create(org.id, {
      label: "Helper",
      pluralLabel: "Helpers",
    });

    for (let index = 0; index < 2; index += 1) {
      const user = buildTestUser();
      const [row] = await db
        .insert(users)
        .values({
          id: randomUUID(),
          name: user.name,
          email: user.email,
          organizationId: org.id,
        })
        .returning({ id: users.id });
      await addMember(row.id, org.id, "member", type.key);
    }

    await createForm(org.id, {
      settings: { assignedMemberTypes: [type.key] },
    });

    await expect(MemberTypeService.delete(org.id, type.key)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof MemberTypeError &&
        error.reason === "in_use" &&
        error.message === memberTypeInUseMessage(2, 1, "Helper"),
    );
    expect(await MemberTypeService.findByKey(org.id, type.key)).not.toBeNull();
  });

  it("does not give a deleted type's settings to a new type with its key", async () => {
    const org = await createOrganization(
      `mts-reuse-${randomUUID().slice(0, 8)}`,
      { memberTypes: [] },
    );
    const original = await MemberTypeService.create(org.id, {
      label: "Mentor",
      pluralLabel: "Mentors",
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.NavbarConfig,
      JSON.stringify({
        member: { hidden: ["/media"] },
        [original.key]: { hidden: ["/members"] },
      }),
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.DashboardHeader,
      JSON.stringify({
        default: { title: "Welcome" },
        [original.key]: { title: "Mentor hub" },
      }),
    );
    await setMemberTypeDashboardLayout(
      org.id,
      original.key,
      DEFAULT_MEMBER_LAYOUT,
    );

    await MemberTypeService.delete(org.id, original.key);
    const reused = await MemberTypeService.create(org.id, {
      label: "Mentor",
      pluralLabel: "Mentors",
    });

    expect(reused.key).toBe(original.key);
    expect(await OrganizationConfigService.getNavbarConfig(org.id)).toEqual({
      member: { hidden: ["/media"] },
    });
    expect(await OrganizationConfigService.getDashboardHeader(org.id)).toEqual({
      default: { title: "Welcome" },
    });
    expect(await getMemberTypeDashboardLayout(org.id, reused.key)).toBeNull();
  });

  it("rejects update bodies that include key", async () => {
    const org = await createOrganization(
      `mts-patch-${randomUUID().slice(0, 8)}`,
      {
        memberTypes: [],
      },
    );
    const type = await MemberTypeService.create(org.id, {
      label: "Volunteer",
      pluralLabel: "Volunteers",
    });

    await expect(
      MemberTypeService.update(org.id, type.key, {
        label: "Renamed",
        pluralLabel: "Renamed",
        key: "hijacked",
      } as { label: string; pluralLabel: string }),
    ).rejects.toMatchObject({ reason: "invalid" });

    const row = await MemberTypeService.findByKey(org.id, type.key);
    expect(row?.key).toBe(type.key);
    expect(row?.label).toBe("Volunteer");
  });

  it("isolates organizations on list and mutating calls", async () => {
    const orgA = await createOrganization(`mts-a-${randomUUID().slice(0, 8)}`, {
      memberTypes: [],
    });
    const orgB = await createOrganization(`mts-b-${randomUUID().slice(0, 8)}`, {
      memberTypes: [],
    });

    const board = await MemberTypeService.create(orgA.id, {
      label: "Board",
      pluralLabel: "Boards",
    });

    expect(await MemberTypeService.list(orgB.id)).toEqual([]);

    await expect(
      MemberTypeService.update(orgB.id, board.key, {
        label: "Nope",
        pluralLabel: "Nopes",
      }),
    ).rejects.toMatchObject({ reason: "not_found" });

    await expect(
      MemberTypeService.reorder(orgB.id, [board.key]),
    ).rejects.toMatchObject({ reason: "invalid" });

    await expect(
      MemberTypeService.setSignupDefault(orgB.id, board.key),
    ).rejects.toMatchObject({ reason: "not_found" });

    await expect(
      MemberTypeService.delete(orgB.id, board.key),
    ).rejects.toMatchObject({ reason: "not_found" });

    expect(await MemberTypeService.findByKey(orgA.id, board.key)).toMatchObject(
      {
        label: "Board",
      },
    );

    const { user } = await signUpAndGetSession(buildTestUser(), orgB.slug);
    await expect(
      db.insert(members).values({
        id: randomUUID(),
        userId: user.id,
        organizationId: orgB.id,
        role: "member",
        memberType: board.key,
      }),
    ).rejects.toSatisfy((error: unknown) => pgCode(error, "23503"));
  });

  it("creates distinct keys for concurrent creates with the same label", async () => {
    const org = await createOrganization(
      `mts-race-${randomUUID().slice(0, 8)}`,
      {
        memberTypes: [],
      },
    );

    const [first, second] = await Promise.all([
      MemberTypeService.create(org.id, {
        label: "Volunteer",
        pluralLabel: "Volunteers",
      }),
      MemberTypeService.create(org.id, {
        label: "Volunteer",
        pluralLabel: "Volunteers",
      }),
    ]);

    expect(first.key).not.toBe(second.key);
    expect(await MemberTypeService.list(org.id)).toHaveLength(2);
  });
});
