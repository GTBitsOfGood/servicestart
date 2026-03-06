import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { notifications, NotificationType } from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const organization = await createOrganization("acme");
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

async function createNotification(
  userId: string,
  organizationId: string,
  opts: {
    read?: boolean;
    type?: NotificationType;
    text?: string;
    createdAt?: Date;
  } = {},
) {
  const id = randomUUID();
  await db.insert(notifications).values({
    id,
    userId,
    organizationId,
    read: opts.read ?? false,
    type: opts.type ?? NotificationType.General,
    text: opts.text ?? "Test notification",
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  });
  return id;
}

describe("GET /api/notifications", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.notifications.$get({
      query: {},
    });

    expect(response.status).toBe(401);
  });

  it("returns unread notifications by default for active organization", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");
    const otherUser = buildTestUser();
    const { user: other } = await signUpAndGetSession(otherUser);

    await createNotification(user.id, organization.id, { read: false });
    await createNotification(user.id, organization.id, { read: true });
    await createNotification(user.id, otherOrg.id, { read: false });
    await createNotification(other.id, organization.id, { read: false });

    const response = await testApi.notifications.$get(
      { query: {} },
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    if (!("data" in data)) {
      throw new Error("Response is missing 'data' property");
    }
    if (!("page" in data) || !("pageSize" in data)) {
      throw new Error("Response is missing pagination metadata");
    }
    expect(data.data).toHaveLength(1);
    expect(data.data[0].read).toBe(false);
    expect(data.data[0].organizationId).toBe(organization.id);
    expect(data.data[0].userId).toBe(user.id);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("paginates notifications by page and pageSize query params", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const base = new Date("2026-02-23T00:00:00.000Z");

    const id1 = await createNotification(user.id, organization.id, {
      createdAt: new Date(base.getTime() + 1_000),
      text: "n1",
    });
    const id2 = await createNotification(user.id, organization.id, {
      createdAt: new Date(base.getTime() + 2_000),
      text: "n2",
    });
    const id3 = await createNotification(user.id, organization.id, {
      createdAt: new Date(base.getTime() + 3_000),
      text: "n3",
    });
    const id4 = await createNotification(user.id, organization.id, {
      createdAt: new Date(base.getTime() + 4_000),
      text: "n4",
    });
    const id5 = await createNotification(user.id, organization.id, {
      createdAt: new Date(base.getTime() + 5_000),
      text: "n5",
    });

    const page1Response = await testApi.notifications.$get(
      { query: { page: "1", pageSize: "2" } },
      { headers },
    );
    const page1Data = await page1Response.json();

    const page2Response = await testApi.notifications.$get(
      { query: { page: "2", pageSize: "2" } },
      { headers },
    );
    const page2Data = await page2Response.json();

    expect(page1Response.status).toBe(200);
    expect(page2Response.status).toBe(200);

    if (
      !("data" in page1Data) ||
      !("page" in page1Data) ||
      !("pageSize" in page1Data)
    ) {
      throw new Error("Page 1 response is missing pagination payload");
    }

    if (
      !("data" in page2Data) ||
      !("page" in page2Data) ||
      !("pageSize" in page2Data)
    ) {
      throw new Error("Page 2 response is missing pagination payload");
    }

    expect(page1Data.page).toBe(1);
    expect(page1Data.pageSize).toBe(2);
    expect(page1Data.data).toHaveLength(2);
    expect(page1Data.data.map((item) => item.id)).toEqual([id5, id4]);

    expect(page2Data.page).toBe(2);
    expect(page2Data.pageSize).toBe(2);
    expect(page2Data.data).toHaveLength(2);
    expect(page2Data.data.map((item) => item.id)).toEqual([id3, id2]);

    const returnedIds = new Set([
      ...page1Data.data.map((item) => item.id),
      ...page2Data.data.map((item) => item.id),
    ]);
    expect(returnedIds.has(id1)).toBe(false);
  });

  it("filters by read", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    await createNotification(user.id, organization.id, { read: false });
    await createNotification(user.id, organization.id, { read: true });

    const response = await testApi.notifications.$get(
      { query: { read: "true" } },
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    if (!("data" in data)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(data.data).toHaveLength(1);
    expect(data.data[0].read).toBe(true);
  });

  it("filters by type", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    await createNotification(user.id, organization.id, {
      type: NotificationType.General,
    });
    await createNotification(user.id, organization.id, {
      type: NotificationType.Announcement,
    });

    const response = await testApi.notifications.$get(
      { query: { type: NotificationType.Announcement } },
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    if (!("data" in data)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(data.data).toHaveLength(1);
    expect(data.data[0].type).toBe(NotificationType.Announcement);
  });
});

describe("GET /api/notifications/unreadCount", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.notifications.unreadCount.$get();

    expect(response.status).toBe(401);
  });

  it("returns unread count for active organization", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");
    const otherUser = buildTestUser();
    const { user: other } = await signUpAndGetSession(otherUser);

    // Two unread notifications for current user in active org
    await createNotification(user.id, organization.id, { read: false });
    await createNotification(user.id, organization.id, { read: false });

    // Read notification for current user in active org (should not be counted)
    await createNotification(user.id, organization.id, { read: true });

    // Unread notification for current user in a different org (should not be counted)
    await createNotification(user.id, otherOrg.id, { read: false });

    // Unread notification for a different user in active org (should not be counted)
    await createNotification(other.id, organization.id, { read: false });

    const response = await testApi.notifications.unreadCount.$get(
      {},
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("count", 2);
  });
});

describe("PATCH /api/notifications/:id", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.notifications[":id"].$patch({
      param: { id: randomUUID() },
      json: { read: true },
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when notification does not exist", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.notifications[":id"].$patch(
      {
        param: { id: randomUUID() },
        json: { read: true },
      },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 403 when notification belongs to another user", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const otherUser = buildTestUser();
    const { user: other, session: otherSession } =
      await signUpAndGetSession(otherUser);
    await setActiveOrganization(otherSession.id, organization.id);
    await addMember(other.id, organization.id, "member");

    const notificationId = await createNotification(other.id, organization.id, {
      read: false,
    });

    const response = await testApi.notifications[":id"].$patch(
      {
        param: { id: notificationId },
        json: { read: true },
      },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("updates read status for owned notification", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const notificationId = await createNotification(user.id, organization.id, {
      read: false,
    });

    const response = await testApi.notifications[":id"].$patch(
      {
        param: { id: notificationId },
        json: { read: true },
      },
      { headers },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("read", true);
  });
});
