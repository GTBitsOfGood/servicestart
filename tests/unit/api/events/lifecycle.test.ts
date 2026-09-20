// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  events,
  eventHosts,
  eventRsvps,
  eventTags,
  tags,
  EventVisibility,
} from "@/lib/schema";
import {
  addMember,
  buildTestUser,
  createEvent,
  createOrganization,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function setupOrgAndUser(role: "owner" | "admin" | "member") {
  const organization = await createOrganization(`acme-${randomUUID()}`);
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organization.id);
  await addMember(user.id, organization.id, role);
  return { organization, user, session, headers };
}

/** Adds a second user to an existing organization and signs them in. */
async function addUserToOrg(
  organizationId: string,
  role: "owner" | "admin" | "member",
) {
  const testUser = buildTestUser();
  const { user, session, headers } = await signUpAndGetSession(testUser);
  await setActiveOrganization(session.id, organizationId);
  await addMember(user.id, organizationId, role);
  return { user, headers };
}

async function createTag(organizationId: string, tag: string) {
  const tagId = randomUUID();
  await db.insert(tags).values({ tagId, organizationId, tag });
  return tagId;
}

const futureStart = "2030-06-15T14:00:00Z";

function draftPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Community Picnic",
    location: "",
    visibility: EventVisibility.Public,
    published: false,
    ...overrides,
  };
}

function publishablePayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Community Picnic",
    location: "123 Peachtree St, Atlanta, GA, 30308",
    startTimestamp: futureStart,
    duration: "120 minutes",
    description: "Bring a dish",
    visibility: EventVisibility.Public,
    published: true,
    ...overrides,
  };
}

describe("creating drafts and published events", () => {
  it("creates an unpublished draft with only a name", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      { json: draftPayload() },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      id: string;
      publishedAt: string | null;
      organizationId: string;
    };
    expect(data.publishedAt).toBeNull();
    expect(data.organizationId).toBe(organization.id);
  });

  it("publishes on creation when asked to", async () => {
    const { user, headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      { json: publishablePayload() },
      { headers },
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      id: string;
      publishedAt: string | null;
      publishedById: string | null;
    };
    expect(data.publishedAt).not.toBeNull();
    expect(data.publishedById).toBe(user.id);
  });

  it("refuses to publish an event that is missing its details", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      { json: draftPayload({ published: true }) },
      { headers },
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/before publishing/i);
  });

  it("rejects a registration deadline after the start time", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      {
        json: publishablePayload({ rsvpDeadline: "2030-06-20T14:00:00Z" }),
      },
      { headers },
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/deadline/i);
  });

  it("rejects a non-positive capacity", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      { json: publishablePayload({ rsvpLimit: 0 }) },
      { headers },
    );

    expect(response.status).toBe(400);
  });

  it("rejects a zero-length duration", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      { json: publishablePayload({ duration: "0 minutes" }) },
      { headers },
    );

    expect(response.status).toBe(400);
  });

  it("rejects links that are not URLs", async () => {
    const { headers } = await setupOrgAndUser("admin");

    const response = await testApi.events.$post(
      { json: publishablePayload({ links: ["not a url"] }) },
      { headers },
    );

    expect(response.status).toBe(400);
  });

  it("rejects a tag from another organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const foreignTag = await createTag(otherOrg.id, "Outreach");

    const response = await testApi.events.$post(
      { json: publishablePayload({ tagIds: [foreignTag] }) },
      { headers },
    );

    expect(response.status).toBe(404);
  });
});

describe("draft visibility", () => {
  it("hides a draft from members reading it directly", async () => {
    const { organization } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Secret Draft",
      publishedAt: null,
    });
    const { headers: memberHeaders } = await addUserToOrg(
      organization.id,
      "member",
    );

    const response = await testApi.events[":eventId"].$get(
      { param: { eventId } },
      { headers: memberHeaders },
    );

    expect(response.status).toBe(404);
  });

  it("shows a draft to an admin of the owning organization", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Secret Draft",
      publishedAt: null,
    });

    const response = await testApi.events[":eventId"].$get(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(200);
  });

  it("hides a draft from an admin of another organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const eventId = await createEvent(otherOrg.id, {
      name: "Their Draft",
      publishedAt: null,
    });

    const response = await testApi.events[":eventId"].$get(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("hides a member-only event from another organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const eventId = await createEvent(otherOrg.id, {
      name: "Their Members Event",
      visibility: EventVisibility.Member,
    });

    const response = await testApi.events[":eventId"].$get(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("keeps drafts out of the list members see", async () => {
    const { organization } = await setupOrgAndUser("admin");
    await createEvent(organization.id, {
      name: "Draft",
      publishedAt: null,
    });
    await createEvent(organization.id, { name: "Published" });
    const { headers: memberHeaders } = await addUserToOrg(
      organization.id,
      "member",
    );

    const response = await testApi.events.$get(
      { query: {} },
      { headers: memberHeaders },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { name: string }[] };
    expect(body.data.map((event) => event.name)).toEqual(["Published"]);
  });

  it("lets admins list drafts", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    await createEvent(organization.id, { name: "Draft", publishedAt: null });
    await createEvent(organization.id, { name: "Published" });

    const response = await testApi.events.$get(
      { query: { published: "false" } },
      { headers },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { name: string }[] };
    expect(body.data.map((event) => event.name)).toEqual(["Draft"]);
  });
});

describe("editing an event", () => {
  it("updates every editable field", async () => {
    const { organization, user, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, { name: "Before" });
    const tagId = await createTag(organization.id, "Outreach");

    const response = await testApi.events[":eventId"].$patch(
      {
        param: { eventId },
        json: {
          name: "After",
          location: "456 Juniper St, Atlanta, GA, 30308",
          description: "Updated description",
          startTimestamp: futureStart,
          duration: "90 minutes",
          rsvpLimit: 40,
          rsvpDeadline: "2030-06-10T14:00:00Z",
          visibility: EventVisibility.Member,
          accessibilityNotes: "Step-free access",
          links: ["https://example.org"],
          tagIds: [tagId],
          hosts: [user.email],
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);

    const [stored] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    expect(stored.name).toBe("After");
    expect(stored.location).toBe("456 Juniper St, Atlanta, GA, 30308");
    expect(stored.description).toBe("Updated description");
    expect(stored.rsvpLimit).toBe(40);
    expect(stored.visibility).toBe(EventVisibility.Member);
    expect(stored.accessibilityNotes).toBe("Step-free access");
    expect(stored.links).toEqual(["https://example.org"]);

    const storedTags = await db
      .select()
      .from(eventTags)
      .where(eq(eventTags.eventId, eventId));
    expect(storedTags.map((row) => row.tagId)).toEqual([tagId]);

    const storedHosts = await db
      .select()
      .from(eventHosts)
      .where(eq(eventHosts.eventId, eventId));
    expect(storedHosts.map((row) => row.userId)).toEqual([user.id]);
  });

  it("replaces hosts and tags rather than appending", async () => {
    const { organization, user, headers } = await setupOrgAndUser("admin");
    const { user: coHost } = await addUserToOrg(organization.id, "member");
    const eventId = await createEvent(organization.id, { name: "Event" });
    const firstTag = await createTag(organization.id, "First");
    const secondTag = await createTag(organization.id, "Second");

    await testApi.events[":eventId"].$patch(
      {
        param: { eventId },
        json: { hosts: [user.email, coHost.email], tagIds: [firstTag] },
      },
      { headers },
    );

    await testApi.events[":eventId"].$patch(
      {
        param: { eventId },
        json: { hosts: [coHost.email], tagIds: [secondTag] },
      },
      { headers },
    );

    const storedHosts = await db
      .select()
      .from(eventHosts)
      .where(eq(eventHosts.eventId, eventId));
    expect(storedHosts.map((row) => row.userId)).toEqual([coHost.id]);

    const storedTags = await db
      .select()
      .from(eventTags)
      .where(eq(eventTags.eventId, eventId));
    expect(storedTags.map((row) => row.tagId)).toEqual([secondTag]);
  });

  it("rejects a host who is not in the organization", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, { name: "Event" });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { hosts: ["stranger@example.org"] } },
      { headers },
    );

    expect(response.status).toBe(404);
  });

  it("refuses edits from a member", async () => {
    const { organization } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, { name: "Event" });
    const { headers: memberHeaders } = await addUserToOrg(
      organization.id,
      "member",
    );

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { name: "Hijacked" } },
      { headers: memberHeaders },
    );

    expect(response.status).toBe(403);
  });

  it("refuses edits from an admin of another organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const eventId = await createEvent(otherOrg.id, { name: "Their Event" });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { name: "Hijacked" } },
      { headers },
    );

    expect(response.status).toBe(404);
  });
});

describe("publishing and unpublishing", () => {
  it("publishes a complete draft", async () => {
    const { organization, user, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Draft",
      publishedAt: null,
      startTimestamp: new Date(futureStart),
      duration: "120 minutes",
      description: "Bring a dish",
    });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { published: true } },
      { headers },
    );

    expect(response.status).toBe(200);
    const [stored] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    expect(stored.publishedAt).not.toBeNull();
    expect(stored.publishedById).toBe(user.id);
  });

  it("refuses to publish a draft that is still incomplete", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Draft",
      publishedAt: null,
    });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { published: true } },
      { headers },
    );

    expect(response.status).toBe(400);
    const [stored] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    expect(stored.publishedAt).toBeNull();
  });

  it("publishes a draft completed in the same request", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Draft",
      publishedAt: null,
    });

    const response = await testApi.events[":eventId"].$patch(
      {
        param: { eventId },
        json: {
          published: true,
          location: "123 Peachtree St, Atlanta, GA, 30308",
          startTimestamp: futureStart,
          duration: "120 minutes",
          description: "Bring a dish",
        },
      },
      { headers },
    );

    expect(response.status).toBe(200);
  });

  it("unpublishes a published event back to a draft", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, { name: "Live Event" });

    const response = await testApi.events[":eventId"].$patch(
      { param: { eventId }, json: { published: false } },
      { headers },
    );

    expect(response.status).toBe(200);
    const [stored] = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    expect(stored.publishedAt).toBeNull();
    expect(stored.publishedById).toBeNull();
  });
});

describe("registration rules", () => {
  it("refuses registration for a draft", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Draft",
      publishedAt: null,
    });

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(400);
    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(0);
  });

  it("reports a repeat registration without duplicating it", async () => {
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
    const data = (await response.json()) as { status: string };
    expect(data.status).toBe("already-registered");

    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(1);
  });

  it("never exceeds capacity when registrations arrive together", async () => {
    const { organization } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, {
      name: "Small Event",
      rsvpLimit: 2,
    });

    const members = await Promise.all(
      Array.from({ length: 6 }, () => addUserToOrg(organization.id, "member")),
    );

    const responses = await Promise.all(
      members.map(({ headers }) =>
        testApi.events[":eventId"].rsvps.$post(
          { param: { eventId }, query: {} },
          { headers },
        ),
      ),
    );

    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));

    expect(rsvps).toHaveLength(2);
    expect(responses.filter((r) => r.status === 200)).toHaveLength(2);
    expect(responses.filter((r) => r.status === 400)).toHaveLength(4);
  });

  it("closes withdrawal once the deadline has passed", async () => {
    const { organization, user, headers } = await setupOrgAndUser("member");
    const eventId = await createEvent(organization.id, {
      name: "Event",
      rsvpDeadline: new Date("2000-06-15T14:00:00Z"),
    });
    await db.insert(eventRsvps).values({ eventId, userId: user.id });

    const response = await testApi.events[":eventId"].rsvps.$delete(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(400);
    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(1);
  });

  it("refuses registration for another organization's event", async () => {
    const { headers } = await setupOrgAndUser("member");
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const eventId = await createEvent(otherOrg.id, { name: "Their Event" });

    const response = await testApi.events[":eventId"].rsvps.$post(
      { param: { eventId }, query: {} },
      { headers },
    );

    expect(response.status).toBe(404);
  });
});

describe("deleting an event", () => {
  it("removes the event and its registrations for an admin", async () => {
    const { organization, headers } = await setupOrgAndUser("admin");
    const eventId = await createEvent(organization.id, { name: "Event" });
    const { user: attendee } = await addUserToOrg(organization.id, "member");
    await db.insert(eventRsvps).values({ eventId, userId: attendee.id });

    const response = await testApi.events[":eventId"].$delete(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(200);
    const remaining = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    expect(remaining).toHaveLength(0);
    const rsvps = await db
      .select()
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, eventId));
    expect(rsvps).toHaveLength(0);
  });

  it("refuses deletion from an admin of another organization", async () => {
    const { headers } = await setupOrgAndUser("admin");
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const eventId = await createEvent(otherOrg.id, { name: "Their Event" });

    const response = await testApi.events[":eventId"].$delete(
      { param: { eventId } },
      { headers },
    );

    expect(response.status).toBe(404);
    const remaining = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));
    expect(remaining).toHaveLength(1);
  });
});
