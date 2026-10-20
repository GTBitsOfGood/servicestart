// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { members, MemberType, OrganizationConfigKey } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import {
  addMember,
  buildTestUser,
  createEvent,
  createEventRSVP,
  createOrganization,
  createShift,
  createShiftRSVP,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

type MemberActivityBody = Record<
  string,
  { totalHours: number; lastActive: string | null }
>;

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const slug = `members-api-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const organization = await createOrganization(slug);
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

describe("GET /api/members", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.members.$get({
      query: {},
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when user is a regular member", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.members.$get({ query: {} }, { headers });

    expect(response.status).toBe(403);
  });

  it("returns paginated members list for admin", async () => {
    const { organization, user, headers } = await setupOrgAndUser("admin");

    const secondUser = buildTestUser();
    const { user: user2 } = await signUpAndGetSession(secondUser);
    await addMember(user2.id, organization.id, "member");

    const response = await testApi.members.$get(
      { query: { page: "1", pageSize: "10" } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("data" in data)) throw new Error("Response missing 'data'");

    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(10);
    expect(data.data).toHaveLength(2);

    const userIds = data.data.map((m: { userId: string }) => m.userId);
    expect(userIds).toContain(user.id);
    expect(userIds).toContain(user2.id);
  });

  it("respects pagination params", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    for (let i = 0; i < 3; i++) {
      const u = buildTestUser();
      const { user } = await signUpAndGetSession(u);
      await addMember(user.id, organization.id, "member");
    }

    const page1Response = await testApi.members.$get(
      { query: { page: "1", pageSize: "2" } },
      { headers },
    );
    expect(page1Response.status).toBe(200);
    const page1 = await page1Response.json();
    if (!("data" in page1)) throw new Error("Response missing 'data'");
    expect(page1.data).toHaveLength(2);
    expect(page1.total).toBe(4);

    const page2Response = await testApi.members.$get(
      { query: { page: "2", pageSize: "2" } },
      { headers },
    );
    expect(page2Response.status).toBe(200);
    const page2 = await page2Response.json();
    if (!("data" in page2)) throw new Error("Response missing 'data'");
    expect(page2.data).toHaveLength(2);
  });

  it("returns 200 for owner", async () => {
    const { headers } = await setupOrgAndUser("owner");

    const response = await testApi.members.$get({ query: {} }, { headers });

    expect(response.status).toBe(200);
  });

  it("returns member fields", async () => {
    const { user, headers } = await setupOrgAndUser("admin");

    const response = await testApi.members.$get({ query: {} }, { headers });

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("data" in data)) throw new Error("Response missing 'data'");

    const member = data.data.find(
      (m: { userId: string }) => m.userId === user.id,
    );
    expect(member).toBeDefined();
    expect(member).toMatchObject({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: "admin",
    });
  });
});

describe("GET /api/members/activity", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.members.activity.$get({
      query: { userIds: ["some-id"] },
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when user is a regular member", async () => {
    const { user, headers } = await setupOrgAndUser("member");

    const response = await testApi.members.activity.$get(
      { query: { userIds: [user.id] } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("returns zero hours and null lastActive for user with no RSVPs", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const { user: memberUser } = await signUpAndGetSession(buildTestUser());
    await addMember(memberUser.id, organization.id, "member");

    const response = await testApi.members.activity.$get(
      { query: { userIds: [memberUser.id] } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      [memberUser.id]: { totalHours: 0, lastActive: null },
    });
  });

  it("returns hours from past event RSVPs", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const { user: memberUser } = await signUpAndGetSession(buildTestUser());
    await addMember(memberUser.id, organization.id, "member");

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(organization.id, {
      startTimestamp: pastDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, memberUser.id);

    const response = await testApi.members.activity.$get(
      { query: { userIds: [memberUser.id] } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as MemberActivityBody;
    expect(data[memberUser.id]).toBeDefined();
    expect(data[memberUser.id].totalHours).toBe(1);
    expect(data[memberUser.id].lastActive).not.toBeNull();
  });

  it("returns hours from past shift RSVPs", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const { user: memberUser } = await signUpAndGetSession(buildTestUser());
    await addMember(memberUser.id, organization.id, "member");

    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const shiftId = await createShift(organization.id, {
      startTimestamp: pastDate,
      duration: 3600,
    });
    await createShiftRSVP(shiftId, memberUser.id);

    const response = await testApi.members.activity.$get(
      { query: { userIds: [memberUser.id] } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as MemberActivityBody;
    expect(data[memberUser.id].totalHours).toBe(1);
    expect(data[memberUser.id].lastActive).not.toBeNull();
  });

  it("does not count future event RSVPs", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const { user: memberUser } = await signUpAndGetSession(buildTestUser());
    await addMember(memberUser.id, organization.id, "member");

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(organization.id, {
      startTimestamp: futureDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, memberUser.id);

    const response = await testApi.members.activity.$get(
      { query: { userIds: [memberUser.id] } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as MemberActivityBody;
    expect(data[memberUser.id].totalHours).toBe(0);
    expect(data[memberUser.id].lastActive).toBeNull();
  });

  it("accumulates hours from both events and shifts", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const { user: memberUser } = await signUpAndGetSession(buildTestUser());
    await addMember(memberUser.id, organization.id, "member");

    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(organization.id, {
      startTimestamp: pastDate,
      duration: "3600",
    });
    await createEventRSVP(eventId, memberUser.id);

    const shiftId = await createShift(organization.id, {
      startTimestamp: pastDate,
      duration: 3600,
    });
    await createShiftRSVP(shiftId, memberUser.id);

    const response = await testApi.members.activity.$get(
      { query: { userIds: [memberUser.id] } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as MemberActivityBody;
    expect(data[memberUser.id].totalHours).toBe(2);
  });

  it("does not count RSVPs from other organizations", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("act-other-org");

    const { user: memberUser } = await signUpAndGetSession(buildTestUser());
    await addMember(memberUser.id, organization.id, "member");

    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const otherEventId = await createEvent(otherOrg.id, {
      startTimestamp: pastDate,
      duration: "3600",
    });
    await createEventRSVP(otherEventId, memberUser.id);

    const response = await testApi.members.activity.$get(
      { query: { userIds: [memberUser.id] } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as MemberActivityBody;
    expect(data[memberUser.id].totalHours).toBe(0);
    expect(data[memberUser.id].lastActive).toBeNull();
  });

  it("returns results for multiple user IDs", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const { user: user1 } = await signUpAndGetSession(buildTestUser());
    const { user: user2 } = await signUpAndGetSession(buildTestUser());
    await addMember(user1.id, organization.id, "member");
    await addMember(user2.id, organization.id, "member");

    const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const eventId = await createEvent(organization.id, {
      startTimestamp: pastDate,
      duration: "7200",
    });
    await createEventRSVP(eventId, user1.id);

    const response = await testApi.members.activity.$get(
      { query: { userIds: [user1.id, user2.id] } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as MemberActivityBody;
    expect(data[user1.id].totalHours).toBe(2);
    expect(data[user2.id].totalHours).toBe(0);
  });

  it("returns 400 when no userIds are provided", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.members.activity.$get(
      { query: { userIds: [] } },
      { headers },
    );

    expect(response.status).toBe(400);
  });
});

describe("PATCH /api/members/type", () => {
  async function setupTypesOrg(role: "owner" | "admin" | "member" = "admin") {
    const setup = await setupOrgAndUser(role);
    await OrganizationConfigService.setConfig(
      setup.organization.id,
      OrganizationConfigKey.MemberTypesEnabled,
      "true",
    );
    return setup;
  }

  async function addApplicants(organizationId: string, count: number) {
    const userIds: string[] = [];
    for (let i = 0; i < count; i++) {
      const { user } = await signUpAndGetSession(buildTestUser());
      await db.insert(members).values({
        id: randomUUID(),
        userId: user.id,
        organizationId,
        role: "member",
        memberType: MemberType.Applicant,
      });
      userIds.push(user.id);
    }
    return userIds;
  }

  async function getTypes(organizationId: string, userIds: string[]) {
    const rows = await db
      .select({ memberType: members.memberType })
      .from(members)
      .where(
        and(
          eq(members.organizationId, organizationId),
          inArray(members.userId, userIds),
        ),
      );
    return rows.map((row) => row.memberType);
  }

  it("changes one member's type", async () => {
    const { organization, headers } = await setupTypesOrg();
    const userIds = await addApplicants(organization.id, 1);

    const response = await testApi.members.type.$patch(
      { json: { userIds, memberType: MemberType.Attendee } },
      { headers },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 1 });
    expect(await getTypes(organization.id, userIds)).toEqual([
      MemberType.Attendee,
    ]);
  });

  it("changes many members' types", async () => {
    const { organization, headers } = await setupTypesOrg("owner");
    const userIds = await addApplicants(organization.id, 3);

    const response = await testApi.members.type.$patch(
      { json: { userIds, memberType: MemberType.Attendee } },
      { headers },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 3 });
    expect(await getTypes(organization.id, userIds)).toEqual([
      MemberType.Attendee,
      MemberType.Attendee,
      MemberType.Attendee,
    ]);
  });

  it("returns 401 when not logged in", async () => {
    const response = await testApi.members.type.$patch({
      json: { userIds: ["anyone"], memberType: MemberType.Attendee },
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 for a regular member", async () => {
    const { organization, headers } = await setupTypesOrg("member");
    const userIds = await addApplicants(organization.id, 1);

    const response = await testApi.members.type.$patch(
      { json: { userIds, memberType: MemberType.Attendee } },
      { headers },
    );

    expect(response.status).toBe(403);
    expect(await getTypes(organization.id, userIds)).toEqual([
      MemberType.Applicant,
    ]);
  });

  it("returns 404 when member types are off", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const userIds = await addApplicants(organization.id, 1);

    const response = await testApi.members.type.$patch(
      { json: { userIds, memberType: MemberType.Attendee } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 400 for a type that isn't a MemberType", async () => {
    const { organization, headers } = await setupTypesOrg();
    const userIds = await addApplicants(organization.id, 1);

    const response = await testApi.members.type.$patch(
      { json: { userIds, memberType: "camper" as MemberType } },
      { headers },
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when a target is an admin", async () => {
    const { organization, user, headers } = await setupTypesOrg();
    const userIds = await addApplicants(organization.id, 1);

    const response = await testApi.members.type.$patch(
      {
        json: {
          userIds: [...userIds, user.id],
          memberType: MemberType.Attendee,
        },
      },
      { headers },
    );

    expect(response.status).toBe(400);
    expect(await getTypes(organization.id, userIds)).toEqual([
      MemberType.Applicant,
    ]);
  });

  it("doesn't let an org B admin change org A's members", async () => {
    const orgA = await setupTypesOrg();
    const orgAUserIds = await addApplicants(orgA.organization.id, 2);
    const orgB = await setupTypesOrg();

    const response = await testApi.members.type.$patch(
      { json: { userIds: orgAUserIds, memberType: MemberType.Attendee } },
      { headers: orgB.headers },
    );

    expect(response.status).toBe(404);
    expect(await getTypes(orgA.organization.id, orgAUserIds)).toEqual([
      MemberType.Applicant,
      MemberType.Applicant,
    ]);
  });
});
