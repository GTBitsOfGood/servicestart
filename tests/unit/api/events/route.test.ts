import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { events, eventRsvps, shifts } from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createEvent,
  createOrganization,
  createShift,
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

describe("POST /api/events", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events.$post({
      json: {
        name: "Temp Event",
        location: "Event Space 1",
        startTimestamp: null,
        duration: null,
      },
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.events.$post(
      {
        json: {
          name: "Temp Event",
          location: "Event Space 1",
          startTimestamp: null,
          duration: null,
        },
      },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("creates an event linked to the active organization", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      {
        json: {
          name: "Temp Event 2",
          location: "Atlanta",
          startTimestamp: "2026-06-15T14:00:00Z",
          duration: "03:00:00",
          description: "Annual event",
          coverImageUrl: "https://example.com/picnic.jpg",
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      id: string;
      name: string;
      location: string;
      description: string | null;
      duration: string | null;
      coverImageUrl: string | null;
    };
    if (!("id" in data)) {
      throw new Error("Response data is missing 'id' property");
    }

    const [row] = await db.select().from(events).where(eq(events.id, data.id));
    expect(row).toBeDefined();
    expect(row.organizationId).toBe(organization.id);
    expect(row.name).toBe("Temp Event 2");
    expect(row.location).toBe("Atlanta");
    expect(row.description).toBe("Annual event");
    expect(row.duration).toBe("03:00:00");
  });

  it("creates an event with minimal required fields", async () => {
    const { organization, headers } = await setupOrgAndUser("owner");

    const response = await testApi.events.$post(
      {
        json: {
          name: "Temp Event 2",
          location: "Georgia Tech",
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("id" in data)) {
      throw new Error("Response data is missing 'id' property");
    }

    const [row] = await db.select().from(events).where(eq(events.id, data.id));
    expect(row.organizationId).toBe(organization.id);
    expect(row.description).toBeNull();
    expect(row.startTimestamp).toBeNull();
    expect(row.duration).toBeNull();
    expect(row.coverImageUrl).toBeNull();
  });
});

describe("GET /api/events (list)", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events.$get({ query: {} });
    expect(response.status).toBe(401);
  });

  it("returns events for the active organization only", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");

    await createEvent(organization.id, { name: "Our Event" });
    await createEvent(otherOrg.id, { name: "Their Event" });

    const response = await testApi.events.$get({ query: {} }, { headers });

    expect(response.status).toBe(200);
    const result = await response.json();
    if (!("data" in result)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Our Event");
  });

  it("paginates results correctly", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    for (let i = 0; i < 5; i++) {
      await createEvent(organization.id, { name: `Event ${i}` });
    }

    const response = await testApi.events.$get(
      { query: { page: 1, pageSize: 2 } },
      { headers },
    );

    const result = await response.json();
    if (!("data" in result)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(result.data).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);

    const response2 = await testApi.events.$get(
      { query: { page: 2, pageSize: 2 } },
      { headers },
    );
    const result2 = await response2.json();
    if (!("data" in result2)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(result2.data).toHaveLength(2);
    expect(result2.page).toBe(2);
  });

  it("returns empty array when organization has no events", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.events.$get({ query: {} }, { headers });

    expect(response.status).toBe(200);
    const result = await response.json();
    if (!("data" in result)) {
      throw new Error("Response is missing 'data' property");
    }
    expect(result.data).toHaveLength(0);
  });
});

describe("GET /api/events/:eventId/shifts", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events[":eventId"].shifts.$get({
      param: { eventId: "event-1" },
      query: {},
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events[":eventId"].shifts.$get(
      {
        param: { eventId: "missing-event" },
        query: {},
      },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when event not in active organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("other");
    const otherEventId = await createEvent(otherOrg.id);

    const response = await testApi.events[":eventId"].shifts.$get(
      {
        param: { eventId: otherEventId },
        query: {},
      },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns paginated shifts for the event", async () => {
    const { headers, organization } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id);
    const otherEventId = await createEvent(organization.id);

    await createShift(organization.id, { eventId, name: "Shift 1" });
    await createShift(organization.id, { eventId, name: "Shift 2" });
    await createShift(organization.id, { eventId, name: "Shift 3" });
    await createShift(organization.id, {
      eventId: otherEventId,
      name: "Other",
    });

    const response = await testApi.events[":eventId"].shifts.$get(
      {
        param: { eventId },
        query: { page: 1, pageSize: 2 },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      data: { id: string }[];
      page: number;
      pageSize: number;
    };
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(2);
    expect(data.data.length).toBe(2);

    const ids = data.data.map((shift) => shift.id);
    const rows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.eventId, eventId));
    const rowIds = rows.map((row) => row.id);
    expect(ids.every((id: string) => rowIds.includes(id))).toBe(true);
  });
});

describe("GET /api/events/:eventId", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events[":eventId"].$get({
      param: { eventId: "some-id" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events[":eventId"].$get(
      { param: { eventId: "nonexistent" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when event belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");
    const eventId = await createEvent(otherOrg.id, { name: "Other Event" });

    const response = await testApi.events[":eventId"].$get(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns event details for organization member", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, {
      name: "Temp Event 3",
      location: "Scheller",
      description: "Annual event",
    });

    const response = await testApi.events[":eventId"].$get(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("name" in data)) {
      throw new Error("Response data is missing 'name' property");
    }
    expect(data.name).toBe("Temp Event 3");
    expect(data.location).toBe("Scheller");
    expect(data.description).toBe("Annual event");
  });
});

describe("PATCH /api/events/:eventId", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events[":eventId"].$patch({
      param: { eventId: "some-id" },
      json: { name: "Updated" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { name: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when event does not exist", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId: "nonexistent" }, json: { name: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when event belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("other");
    const eventId = await createEvent(otherOrg.id, { name: "Other Event" });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { name: "Updated" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("updates name without requiring all fields", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Original Name",
      location: "Original Location",
      description: "Original Description",
    });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { name: "Updated Name" } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    if (!("name" in data)) {
      throw new Error("Response data is missing 'name' property");
    }
    expect(data.name).toBe("Updated Name");
    expect(data.location).toBe("Original Location");
    expect(data.description).toBe("Original Description");
  });

  it("updates multiple fields at once", async () => {
    const { organization, headers } = await setupOrgAndUser("owner");
    const eventId = await createEvent(organization.id, {
      name: "Old Event",
      location: "Old Location",
    });

    const response = await testApi.events[":eventId"].$patch(
      {
        param: { eventId },
        json: {
          name: "New Event",
          location: "New Location",
          description: "New Description",
          duration: "02:00:00",
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      name: string;
      location: string;
      description: string | null;
      duration: string | null;
    };
    expect(data.name).toBe("New Event");
    expect(data.location).toBe("New Location");
    expect(data.description).toBe("New Description");
    expect(data.duration).toBe("02:00:00");
  });

  it("sets fields to null when provided", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Event",
      location: "Location",
      description: "Description",
      duration: "1 hour",
    });

    const response = await testApi.events[":eventId"].$patch(
      {
        param: { eventId },
        json: {
          description: null,
          duration: null,
          coverImageUrl: null,
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      description: string | null;
      duration: string | null;
      coverImageUrl: string | null;
    };
    expect(data.description).toBeNull();
    expect(data.duration).toBeNull();
    expect(data.coverImageUrl).toBeNull();
  });
});

describe("DELETE /api/events/:eventId", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events[":eventId"].$delete({
      param: { eventId: "some-id" },
    });
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not admin or owner", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].$delete(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("returns 404 when event does not exist", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events[":eventId"].$delete(
      { param: { eventId: "nonexistent" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when event belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization("other");
    const eventId = await createEvent(otherOrg.id, { name: "Other Event" });

    const response = await testApi.events[":eventId"].$delete(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("deletes the event", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].$delete(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { success: true };
    expect(data.success).toBe(true);

    const rows = await db.select().from(events).where(eq(events.id, eventId));
    expect(rows).toHaveLength(0);
  });

  it("cascades delete to RSVPs", async () => {
    const { organization, user, headers } = await setupOrgAndUser("owner");
    const eventId = await createEvent(organization.id, { name: "Event" });

    await db.insert(eventRsvps).values({ eventId, userId: user.id });

    const response = await testApi.events[":eventId"].$delete(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(200);

    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(0);
  });
});

describe("POST /api/events/:eventId/rsvps", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events[":eventId"].rsvps.$post({
      param: { eventId: "some-id" },
      query: {},
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId: "nonexistent" }, query: {} },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when event belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");
    const eventId = await createEvent(otherOrg.id, { name: "Other Event" });

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("allows user to RSVP to event in their organization", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      eventId: string;
      userId: string;
      status: string;
    };
    expect(data.eventId).toBe(eventId);
    expect(data.userId).toBe(user.id);
    expect(data.status).toBe("added");

    const [rsvp] = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvp.userId).toBe(user.id);
  });

  it("is idempotent - adding same RSVP twice succeeds", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, { name: "Event" });

    await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: {} },
      { headers },
    );

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(200);

    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(1);
  });

  it("returns 403 when non-admin tries to RSVP for another user", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const otherUser = buildTestUser();
    const { user: otherUserRecord } = await signUpAndGetSession(otherUser);
    await addMember(otherUserRecord.id, organization.id, "member");

    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: { userId: otherUserRecord.id } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("allows admin to RSVP for another user", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const otherUser = buildTestUser();
    const { user: otherUserRecord } = await signUpAndGetSession(otherUser);
    await addMember(otherUserRecord.id, organization.id, "member");

    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: { userId: otherUserRecord.id } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { userId: string };
    expect(data.userId).toBe(otherUserRecord.id);

    const [rsvp] = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvp.userId).toBe(otherUserRecord.id);
  });

  it("returns 404 when admin tries to RSVP non-member to event", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const otherUser = buildTestUser();
    const { user: otherUserRecord } = await signUpAndGetSession(otherUser);

    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: { userId: otherUserRecord.id } },
      { headers },
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/events/:eventId/rsvps", () => {
  it("returns 401 when not logged in", async () => {
    const response = await testApi.events[":eventId"].rsvps.$delete({
      param: { eventId: "some-id" },
      query: {},
    });
    expect(response.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const { headers } = await setupOrgAndUser("member");

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId: "nonexistent" }, query: {} },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when event belongs to different organization", async () => {
    const { headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization("other");
    const eventId = await createEvent(otherOrg.id, { name: "Other Event" });

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("allows user to remove their own RSVP", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, { name: "Event" });

    await db.insert(eventRsvps).values({ eventId, userId: user.id });

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      eventId: string;
      userId: string;
      status: string;
    };
    expect(data.eventId).toBe(eventId);
    expect(data.userId).toBe(user.id);
    expect(data.status).toBe("removed");

    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(0);
  });

  it("is idempotent - removing non-existent RSVP succeeds", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(200);
  });

  it("returns 403 when non-admin tries to remove another user's RSVP", async () => {
    const { organization, headers } = await setupOrgAndUser("member");
    const otherUser = buildTestUser();
    const { user: otherUserRecord } = await signUpAndGetSession(otherUser);
    await addMember(otherUserRecord.id, organization.id, "member");

    const eventId = await createEvent(organization.id, { name: "Event" });
    await db.insert(eventRsvps).values({ eventId, userId: otherUserRecord.id });

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId }, query: { userId: otherUserRecord.id } },
      { headers },
    );

    expect(response.status).toBe(403);
  });

  it("allows admin to remove another user's RSVP", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const otherUser = buildTestUser();
    const { user: otherUserRecord } = await signUpAndGetSession(otherUser);
    await addMember(otherUserRecord.id, organization.id, "member");

    const eventId = await createEvent(organization.id, { name: "Event" });
    await db.insert(eventRsvps).values({ eventId, userId: otherUserRecord.id });

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId }, query: { userId: otherUserRecord.id } },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { userId: string };
    expect(data.userId).toBe(otherUserRecord.id);

    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(0);
  });

  it("returns 404 when admin tries to remove RSVP for non-member", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const otherUser = buildTestUser();
    const { user: otherUserRecord } = await signUpAndGetSession(otherUser);
    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId }, query: { userId: otherUserRecord.id } },
      { headers },
    );

    expect(response.status).toBe(404);
  });
});
