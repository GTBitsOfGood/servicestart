// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MembersService } from "@/lib/services/MemberService";
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
