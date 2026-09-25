// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import { eventRsvps } from "@/lib/schema";
import { EventService } from "@/lib/services/EventService";
import {
  addMember,
  buildTestUser,
  createEvent,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

async function setupOrgWithMember() {
  const organization = await createOrganization(`acme-${randomUUID()}`);
  const { user } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, organization.id, "member");
  return { organization, user };
}

async function rsvpCount(eventId: string) {
  const rows = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId));
  return rows.length;
}

describe("EventService.register", () => {
  it("registers a member for an open event", async () => {
    const { organization, user } = await setupOrgWithMember();
    const eventId = await createEvent(organization.id);

    const result = await EventService.register(
      eventId,
      organization.id,
      user.id,
    );

    expect(result).toBe("added");
    expect(await rsvpCount(eventId)).toBe(1);
  });

  it("makes a repeat registration safe", async () => {
    const { organization, user } = await setupOrgWithMember();
    const eventId = await createEvent(organization.id);

    await EventService.register(eventId, organization.id, user.id);
    const result = await EventService.register(
      eventId,
      organization.id,
      user.id,
    );

    expect(result).toBe("already-registered");
    expect(await rsvpCount(eventId)).toBe(1);
  });

  it("does not find an event through another organization", async () => {
    const { organization, user } = await setupOrgWithMember();
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const eventId = await createEvent(otherOrg.id);

    const result = await EventService.register(
      eventId,
      organization.id,
      user.id,
    );

    expect(result).toBe("not-visible");
    expect(await rsvpCount(eventId)).toBe(0);
  });

  it("refuses a user who is not a member", async () => {
    const organization = await createOrganization(`acme-${randomUUID()}`);
    const { user } = await signUpAndGetSession(buildTestUser());
    const eventId = await createEvent(organization.id);

    const result = await EventService.register(
      eventId,
      organization.id,
      user.id,
    );

    expect(result).toBe("not-a-member");
  });

  it("refuses a draft", async () => {
    const { organization, user } = await setupOrgWithMember();
    const eventId = await createEvent(organization.id, { publishedAt: null });

    const result = await EventService.register(
      eventId,
      organization.id,
      user.id,
    );

    expect(result).toBe("unpublished");
  });

  it("refuses once the deadline has passed", async () => {
    const { organization, user } = await setupOrgWithMember();
    const eventId = await createEvent(organization.id, {
      rsvpDeadline: new Date("2030-01-02T00:00:00Z"),
    });

    const result = await EventService.register(
      eventId,
      organization.id,
      user.id,
      new Date("2030-01-03T00:00:00Z"),
    );

    expect(result).toBe("deadline-passed");
  });

  it("gives the last place to exactly one of many simultaneous attempts", async () => {
    const organization = await createOrganization(`acme-${randomUUID()}`);
    const eventId = await createEvent(organization.id, { rsvpLimit: 1 });
    const users = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const { user } = await signUpAndGetSession(buildTestUser());
        await addMember(user.id, organization.id, "member");
        return user;
      }),
    );

    const results = await Promise.all(
      users.map((user) =>
        EventService.register(eventId, organization.id, user.id),
      ),
    );

    expect(results.filter((r) => r === "added")).toHaveLength(1);
    expect(results.filter((r) => r === "full")).toHaveLength(4);
    expect(await rsvpCount(eventId)).toBe(1);
  });
});

describe("EventService.withdraw", () => {
  it("removes a registration before the deadline", async () => {
    const { organization, user } = await setupOrgWithMember();
    const eventId = await createEvent(organization.id, {
      rsvpDeadline: new Date("2030-01-05T00:00:00Z"),
    });
    await db.insert(eventRsvps).values({ eventId, userId: user.id });

    const result = await EventService.withdraw(
      eventId,
      organization.id,
      user.id,
      new Date("2030-01-04T00:00:00Z"),
    );

    expect(result).toBe("removed");
    expect(await rsvpCount(eventId)).toBe(0);
  });

  it("closes at the same moment registration closes", async () => {
    const { organization, user } = await setupOrgWithMember();
    const deadline = new Date("2030-01-05T00:00:00Z");
    const eventId = await createEvent(organization.id, {
      rsvpDeadline: deadline,
    });
    await db.insert(eventRsvps).values({ eventId, userId: user.id });

    const withdrawal = await EventService.withdraw(
      eventId,
      organization.id,
      user.id,
      deadline,
    );

    expect(withdrawal).toBe("deadline-passed");
    expect(await rsvpCount(eventId)).toBe(1);
  });

  it("does not reach an event through another organization", async () => {
    const { organization, user } = await setupOrgWithMember();
    const otherOrg = await createOrganization(`other-${randomUUID()}`);
    const eventId = await createEvent(otherOrg.id);
    await db.insert(eventRsvps).values({ eventId, userId: user.id });

    const result = await EventService.withdraw(
      eventId,
      organization.id,
      user.id,
    );

    expect(result).toBe("not-visible");
    expect(await rsvpCount(eventId)).toBe(1);
  });
});
