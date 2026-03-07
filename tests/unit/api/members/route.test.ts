// @vitest-environment node
import { describe, expect, it } from "vitest";
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
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
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
    const data = await response.json();
    expect(data[user1.id].totalHours).toBe(2);
    expect(data[user2.id].totalHours).toBe(0);
  });

  it("returns 400 when no userIds are provided", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.members.activity.$get(
      { query: {} },
      { headers },
    );

    expect(response.status).toBe(400);
  });
});
