// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MembersService } from "@/lib/services/MemberService";
import {
  addMember,
  buildTestUser,
  createOrganization,
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
