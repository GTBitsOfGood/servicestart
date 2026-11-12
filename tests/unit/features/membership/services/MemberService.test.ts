// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/core/db";
import {
  members,
  memberTypes,
  OrganizationConfigKey,
  users,
} from "@/core/db/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { MembersService } from "@/features/membership/services/MemberService";
import {
  addMember,
  buildTestUser,
  createEvent,
  createEventRSVP,
  createOrganization,
  createShift,
  createShiftRSVP,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

describe("MembersService.listMembers", () => {
  it("returns empty array when organization has no members", async () => {
    const org = await createOrganization("list-empty");
    const result = await MembersService.listMembers(org.id, {
      limit: 10,
      offset: 0,
    });
    expect(result).toEqual([]);
  });

  it("returns members with correct fields", async () => {
    const org = await createOrganization("list-fields");
    const testUser = buildTestUser();
    const { user } = await signUpAndGetSession(testUser);
    await addMember(user.id, org.id, "admin");

    const result = await MembersService.listMembers(org.id, {
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: "admin",
    });
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(
      result[0].phoneNumber === null ||
        typeof result[0].phoneNumber === "string",
    ).toBe(true);
  });

  it("only returns members for the given organization", async () => {
    const org1 = await createOrganization("list-org1");
    const org2 = await createOrganization("list-org2");

    const { user: user1 } = await signUpAndGetSession(buildTestUser());
    const { user: user2 } = await signUpAndGetSession(buildTestUser());
    await addMember(user1.id, org1.id, "member");
    await addMember(user2.id, org2.id, "member");

    const result = await MembersService.listMembers(org1.id, {
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe(user1.id);
  });

  it("respects the limit parameter", async () => {
    const org = await createOrganization("list-limit");

    for (let i = 0; i < 5; i++) {
      const { user } = await signUpAndGetSession(buildTestUser());
      await addMember(user.id, org.id, "member");
    }

    const result = await MembersService.listMembers(org.id, {
      limit: 3,
      offset: 0,
    });

    expect(result).toHaveLength(3);
  });

  it("respects the offset parameter", async () => {
    const org = await createOrganization("list-offset");

    const userIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const { user } = await signUpAndGetSession(buildTestUser());
      await addMember(user.id, org.id, "member");
      userIds.push(user.id);
    }

    const page1 = await MembersService.listMembers(org.id, {
      limit: 2,
      offset: 0,
    });
    const page2 = await MembersService.listMembers(org.id, {
      limit: 2,
      offset: 2,
    });

    const allIds = [...page1, ...page2].map((m) => m.userId);
    expect(allIds).toHaveLength(4);
    expect(new Set(allIds).size).toBe(4);
  });

  it("returns members with different roles", async () => {
    const org = await createOrganization("list-roles");
    const { user: adminUser } = await signUpAndGetSession(buildTestUser());
    const { user: memberUser } = await signUpAndGetSession(buildTestUser());
    await addMember(adminUser.id, org.id, "admin");
    await addMember(memberUser.id, org.id, "member");

    const result = await MembersService.listMembers(org.id, {
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(2);
    const roles = result.map((m) => m.role);
    expect(roles).toContain("admin");
    expect(roles).toContain("member");
  });
});

describe("MembersService.getMemberActivity", () => {
  it("returns zero hours and null lastActive for user with no RSVPs", async () => {
    const org = await createOrganization("activity-no-rsvps");
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member");

    const result = await MembersService.getMemberActivity([user.id], org.id);

    expect(result[user.id]).toEqual({ totalHours: 0, lastActive: null });
  });

  it("accumulates hours from past event RSVPs", async () => {
    const org = await createOrganization("activity-event");
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member");

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(org.id, {
      startTimestamp: pastDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, user.id);

    const result = await MembersService.getMemberActivity([user.id], org.id);

    expect(result[user.id].totalHours).toBe(1);
    expect(result[user.id].lastActive).not.toBeNull();
  });

  it("accumulates hours from past shift RSVPs", async () => {
    const org = await createOrganization("activity-shift");
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member");

    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const shiftId = await createShift(org.id, {
      startTimestamp: pastDate,
      duration: 3600,
    });
    await createShiftRSVP(shiftId, user.id);

    const result = await MembersService.getMemberActivity([user.id], org.id);

    expect(result[user.id].totalHours).toBe(1);
    expect(result[user.id].lastActive).not.toBeNull();
  });

  it("does not count future event RSVPs", async () => {
    const org = await createOrganization("activity-future-event");
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member");

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(org.id, {
      startTimestamp: futureDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, user.id);

    const result = await MembersService.getMemberActivity([user.id], org.id);

    expect(result[user.id].totalHours).toBe(0);
    expect(result[user.id].lastActive).toBeNull();
  });

  it("combines hours from both events and shifts", async () => {
    const org = await createOrganization("activity-combined");
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member");

    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(org.id, {
      startTimestamp: pastDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, user.id);

    const shiftId = await createShift(org.id, {
      startTimestamp: pastDate,
      duration: 3600,
    });
    await createShiftRSVP(shiftId, user.id);

    const result = await MembersService.getMemberActivity([user.id], org.id);

    expect(result[user.id].totalHours).toBe(2);
  });

  it("does not count RSVPs from other organizations", async () => {
    const org = await createOrganization("activity-org-isolation");
    const otherOrg = await createOrganization("activity-other-org");
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member");

    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const otherEventId = await createEvent(otherOrg.id, {
      startTimestamp: pastDate,
      duration: "3600",
    });
    await createEventRSVP(otherEventId, user.id);

    const result = await MembersService.getMemberActivity([user.id], org.id);

    expect(result[user.id].totalHours).toBe(0);
    expect(result[user.id].lastActive).toBeNull();
  });

  it("returns results for multiple user IDs", async () => {
    const org = await createOrganization("activity-multi-user");
    const { user: user1 } = await signUpAndGetSession(buildTestUser());
    const { user: user2 } = await signUpAndGetSession(buildTestUser());
    await addMember(user1.id, org.id, "member");
    await addMember(user2.id, org.id, "member");

    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(org.id, {
      startTimestamp: pastDate,
      duration: "7200",
    });
    await createEventRSVP(eventId, user1.id);

    const result = await MembersService.getMemberActivity(
      [user1.id, user2.id],
      org.id,
    );

    expect(result[user1.id].totalHours).toBe(2);
    expect(result[user2.id].totalHours).toBe(0);
  });

  it("uses the most recent lastActive across events and shifts", async () => {
    const org = await createOrganization("activity-last-active");
    const { user } = await signUpAndGetSession(buildTestUser());
    await addMember(user.id, org.id, "member");

    const olderDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const newerDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const eventId = await createEvent(org.id, {
      startTimestamp: olderDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, user.id);

    const shiftId = await createShift(org.id, {
      startTimestamp: newerDate,
      duration: 3600,
    });
    await createShiftRSVP(shiftId, user.id);

    const result = await MembersService.getMemberActivity([user.id], org.id);

    expect(result[user.id].lastActive).not.toBeNull();
    const lastActive = new Date(result[user.id].lastActive!);
    expect(lastActive.getTime()).toBeGreaterThan(olderDate.getTime());
  });
});

describe("MembersService.countByOrganization", () => {
  it("returns 0 for organization with no members", async () => {
    const org = await createOrganization("count-empty");
    const count = await MembersService.countByOrganization(org.id);
    expect(count).toBe(0);
  });

  it("returns correct count for organization with members", async () => {
    const org = await createOrganization("count-has-members");

    for (let i = 0; i < 3; i++) {
      const { user } = await signUpAndGetSession(buildTestUser());
      await addMember(user.id, org.id, "member");
    }

    const count = await MembersService.countByOrganization(org.id);
    expect(count).toBe(3);
  });

  it("does not count members from other organizations", async () => {
    const org1 = await createOrganization("count-org1");
    const org2 = await createOrganization("count-org2");

    const { user: user1 } = await signUpAndGetSession(buildTestUser());
    const { user: user2 } = await signUpAndGetSession(buildTestUser());
    const { user: user3 } = await signUpAndGetSession(buildTestUser());
    await addMember(user1.id, org1.id, "member");
    await addMember(user2.id, org2.id, "member");
    await addMember(user3.id, org2.id, "member");

    expect(await MembersService.countByOrganization(org1.id)).toBe(1);
    expect(await MembersService.countByOrganization(org2.id)).toBe(2);
  });
});

async function addTypedMembers(
  organizationId: string,
  types: (string | null)[],
  role = "member",
) {
  const userIds: string[] = [];
  for (const memberType of types) {
    const { user } = await signUpAndGetSession(buildTestUser());
    await db.insert(members).values({
      id: randomUUID(),
      userId: user.id,
      organizationId,
      role,
      memberType:
        memberType === null ? null : MemberTypeKeySchema.parse(memberType),
    });
    userIds.push(user.id);
  }
  return userIds;
}

async function getTypes(organizationId: string, userIds: string[]) {
  const rows = await db
    .select({ userId: members.userId, memberType: members.memberType })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        inArray(members.userId, userIds),
      ),
    );
  return Object.fromEntries(rows.map((row) => [row.userId, row.memberType]));
}

describe("MembersService.setMemberTypes", () => {
  it("sets the type for one member", async () => {
    const org = await createOrganization("types-single");
    const [userId] = await addTypedMembers(org.id, ["applicant"]);

    const result = await MembersService.setMemberTypes(
      org.id,
      [userId],
      MemberTypeKeySchema.parse("attendee"),
    );

    expect(result).toEqual({ updated: 1 });
    expect(await getTypes(org.id, [userId])).toEqual({
      [userId]: "attendee",
    });
  });

  it("sets the type for many members, ignoring duplicate IDs", async () => {
    const org = await createOrganization("types-bulk");
    const userIds = await addTypedMembers(org.id, [
      MemberTypeKeySchema.parse("applicant"),
      null,
      MemberTypeKeySchema.parse("attendee"),
    ]);

    const result = await MembersService.setMemberTypes(
      org.id,
      [...userIds, userIds[0]],
      MemberTypeKeySchema.parse("attendee"),
    );

    expect(result).toEqual({ updated: 3 });
    expect(Object.values(await getTypes(org.id, userIds))).toEqual([
      MemberTypeKeySchema.parse("attendee"),
      "attendee",
      MemberTypeKeySchema.parse("attendee"),
    ]);
  });

  it("returns not_found for another org's members and leaves them unchanged", async () => {
    const orgA = await createOrganization("types-tenant-a");
    const orgB = await createOrganization("types-tenant-b");
    const orgAIds = await addTypedMembers(orgA.id, ["applicant"]);

    const result = await MembersService.setMemberTypes(
      orgB.id,
      orgAIds,
      MemberTypeKeySchema.parse("attendee"),
    );

    expect(result).toEqual({ error: "not_found" });
    expect(await getTypes(orgA.id, orgAIds)).toEqual({
      [orgAIds[0]]: "applicant",
    });
  });

  it("writes nothing when a batch mixes in an unknown ID", async () => {
    const org = await createOrganization("types-mixed");
    const userIds = await addTypedMembers(org.id, [
      MemberTypeKeySchema.parse("applicant"),
      "applicant",
    ]);

    const result = await MembersService.setMemberTypes(
      org.id,
      [...userIds, randomUUID()],
      MemberTypeKeySchema.parse("attendee"),
    );

    expect(result).toEqual({ error: "not_found" });
    expect(Object.values(await getTypes(org.id, userIds))).toEqual([
      MemberTypeKeySchema.parse("applicant"),
      "applicant",
    ]);
  });

  it("returns not_found when a duplicate row hides an unknown ID", async () => {
    const org = await createOrganization("types-duplicate");
    const [userId] = await addTypedMembers(org.id, ["applicant"]);
    // members has no unique (user, org), so this user has two rows.
    await db.insert(members).values({
      id: randomUUID(),
      userId,
      organizationId: org.id,
      role: "member",
      memberType: MemberTypeKeySchema.parse("applicant"),
    });

    const result = await MembersService.setMemberTypes(
      org.id,
      [userId, randomUUID()],
      MemberTypeKeySchema.parse("attendee"),
    );

    expect(result).toEqual({ error: "not_found" });
    expect(await getTypes(org.id, [userId])).toEqual({
      [userId]: "applicant",
    });
  });

  it("rejects admins and owners and writes nothing", async () => {
    const org = await createOrganization("types-admin");
    const [memberId] = await addTypedMembers(org.id, ["applicant"]);
    const [adminId] = await addTypedMembers(org.id, [null], "admin");
    const [ownerId] = await addTypedMembers(org.id, [null], "owner");

    for (const ids of [[memberId, adminId], [ownerId]]) {
      const result = await MembersService.setMemberTypes(
        org.id,
        ids,
        MemberTypeKeySchema.parse("attendee"),
      );
      expect(result).toEqual({ error: "admin" });
    }
    expect(await getTypes(org.id, [memberId, adminId, ownerId])).toEqual({
      [memberId]: "applicant",
      [adminId]: null,
      [ownerId]: null,
    });
  });
});

describe("MembersService.addSignupMember member type", () => {
  it("assigns the org signup default when one is set", async () => {
    const org = await createOrganization("signup-default-volunteer", {
      memberTypes: [
        {
          key: MemberTypeKeySchema.parse("volunteer"),
          label: "Volunteer",
          pluralLabel: "Volunteers",
          isSignupDefault: true,
        },
        {
          key: MemberTypeKeySchema.parse("staff"),
          label: "Staff",
          pluralLabel: "Staff",
        },
      ],
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const { user } = await signUpAndGetSession(buildTestUser(), org.slug);

    await MembersService.addSignupMember(user.id, org.id);
    expect(
      (await MembersService.findByUserAndOrganization(user.id, org.id))
        ?.memberType,
    ).toBe("volunteer");
  });

  it("assigns null when the org has no member types", async () => {
    const org = await createOrganization("signup-no-types", {
      memberTypes: [],
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const { user } = await signUpAndGetSession(buildTestUser(), org.slug);

    await MembersService.addSignupMember(user.id, org.id);
    expect(
      (await MembersService.findByUserAndOrganization(user.id, org.id))
        ?.memberType,
    ).toBeNull();
  });

  it("still adds the member when its signup default is deleted mid-signup", async () => {
    const volunteer = MemberTypeKeySchema.parse("volunteer");
    const org = await createOrganization("signup-default-deleted", {
      memberTypes: [
        {
          key: volunteer,
          label: "Volunteer",
          pluralLabel: "Volunteers",
          isSignupDefault: true,
        },
      ],
    });
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    const { user } = await signUpAndGetSession(buildTestUser(), org.slug);
    const typeRow = and(
      eq(memberTypes.organizationId, org.id),
      eq(memberTypes.key, volunteer),
    );
    const deleted = Promise.withResolvers<void>();
    const commit = Promise.withResolvers<void>();

    const deleting = db.transaction(async (tx) => {
      await tx.select().from(memberTypes).where(typeRow).for("update");
      await tx.delete(memberTypes).where(typeRow);
      deleted.resolve();
      await commit.promise;
    });
    await deleted.promise;
    const signup = MembersService.addSignupMember(user.id, org.id);
    await waitForBlockedSignup();
    commit.resolve();
    await deleting;
    await signup;

    expect(
      await MembersService.findByUserAndOrganization(user.id, org.id),
    ).toMatchObject({ memberType: null });
  });
});

async function waitForBlockedSignup() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const { rows } = await db.execute<{ blocked: number }>(sql`
      SELECT count(*)::int AS blocked FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND (query ILIKE '%"member_types"%' OR query ILIKE 'insert into "members"%')
    `);
    if ((rows[0]?.blocked ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("signup never waited on the deleted member type");
}

describe("MembersService member type filter", () => {
  it("lists and counts only members of the given type", async () => {
    const org = await createOrganization("types-filter");
    const [applicantId] = await addTypedMembers(org.id, [
      MemberTypeKeySchema.parse("applicant"),
      MemberTypeKeySchema.parse("attendee"),
      null,
    ]);
    const otherOrg = await createOrganization("types-filter-other");
    await addTypedMembers(otherOrg.id, ["applicant"]);

    const applicants = await MembersService.listMembers(org.id, {
      limit: 10,
      offset: 0,
      memberType: MemberTypeKeySchema.parse("applicant"),
    });

    expect(applicants.map((m) => m.userId)).toEqual([applicantId]);
    expect(applicants[0].memberType).toBe("applicant");
    expect(
      await MembersService.countByOrganization(
        org.id,
        MemberTypeKeySchema.parse("applicant"),
      ),
    ).toBe(1);
    expect(
      await MembersService.countByOrganization(
        org.id,
        MemberTypeKeySchema.parse("attendee"),
      ),
    ).toBe(1);
    expect(await MembersService.countByOrganization(org.id)).toBe(3);
    expect(
      await MembersService.listMembers(org.id, { limit: 10, offset: 0 }),
    ).toHaveLength(3);
  });
});

describe("MembersService.addMemberDirectly", () => {
  it("creates a separate user in org B instead of reusing org A's", async () => {
    const orgA = await createOrganization("direct-tenant-a");
    const orgB = await createOrganization("direct-tenant-b");
    const email = `shared-${randomUUID()}@example.com`;
    const orgAUserId = randomUUID();
    await db.insert(users).values({
      id: orgAUserId,
      name: "Org A User",
      email,
      organizationId: orgA.id,
    });

    const member = await MembersService.addMemberDirectly(
      email,
      "Org B User",
      orgB.id,
    );

    expect(member.userId).not.toBe(orgAUserId);
    const [orgBUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, member.userId));
    expect(orgBUser).toMatchObject({ email, organizationId: orgB.id });
    expect(
      await MembersService.findByUserAndOrganization(orgAUserId, orgB.id),
    ).toBeNull();
  });
});
