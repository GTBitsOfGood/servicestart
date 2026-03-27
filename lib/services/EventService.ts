import { createInsertSchema } from "drizzle-orm/zod";
import { and, eq, isNull, isNotNull, count } from "drizzle-orm";
import db from "@/lib/db";
import { z } from "zod";
import { events, eventRsvps, eventHosts } from "@/lib/schema";
import { randomUUID } from "node:crypto";

const insertSchema = createInsertSchema(events).omit({
  id: true,
});

async function create(input: z.infer<typeof insertSchema>) {
  const id = randomUUID();

  const [event] = await db
    .insert(events)
    .values({
      ...input,
      id,
    })
    .returning({
      id: events.id,
      organizationId: events.organizationId,
      name: events.name,
      location: events.location,
      description: events.description,
      startTimestamp: events.startTimestamp,
      duration: events.duration,
      rsvpLimit: events.rsvpLimit,
      rsvpDeadline: events.rsvpDeadline,
      visibility: events.visibility,
      accessibilityNotes: events.accessibilityNotes,
      links: events.links,
      coverImageUrl: events.coverImageUrl,
      publishedAt: events.publishedAt,
      publishedById: events.publishedById,
    });

  return event ?? null;
}

async function deleteById(eventId: string, organizationId: string) {
  const event = await findById(eventId);
  if (!event || event.organizationId !== organizationId) {
    return null;
  }

  await db.delete(events).where(eq(events.id, eventId));

  return event;
}

async function findById(eventId: string) {
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  return event ?? null;
}

async function listByOrganization(
  organizationId: string,
  options: { limit: number; offset: number },
  published?: boolean,
) {
  const conditions = [eq(events.organizationId, organizationId)];
  if (published !== undefined) {
    conditions.push(
      published ? isNotNull(events.publishedAt) : isNull(events.publishedAt),
    );
  }

  const checks = and(...conditions);

  return await db
    .select({
      id: events.id,
      organizationId: events.organizationId,
      name: events.name,
      location: events.location,
      description: events.description,
      startTimestamp: events.startTimestamp,
      duration: events.duration,
      rsvpLimit: events.rsvpLimit,
      rsvpDeadline: events.rsvpDeadline,
      visibility: events.visibility,
      accessibilityNotes: events.accessibilityNotes,
      links: events.links,
      coverImageUrl: events.coverImageUrl,
      publishedAt: events.publishedAt,
      publishedById: events.publishedById,
    })
    .from(events)
    .where(checks)
    .limit(options.limit)
    .offset(options.offset);
}

async function listByPublic(options: { limit: number; offset: number }) {
  return await db
    .select({
      id: events.id,
      organizationId: events.organizationId,
      name: events.name,
      location: events.location,
      description: events.description,
      startTimestamp: events.startTimestamp,
      duration: events.duration,
      rsvpLimit: events.rsvpLimit,
      rsvpDeadline: events.rsvpDeadline,
      visibility: events.visibility,
      accessibilityNotes: events.accessibilityNotes,
      links: events.links,
      coverImageUrl: events.coverImageUrl,
      publishedAt: events.publishedAt,
      publishedById: events.publishedById,
    })
    .from(events)
    .where(and(eq(events.visibility, "public"), isNotNull(events.publishedAt)))
    .limit(options.limit)
    .offset(options.offset);
}

async function updateEvent(
  eventId: string,
  organizationId: string,
  updates: {
    name?: string;
    location?: string;
    description?: string | null;
    startTimestamp?: Date | null;
    duration?: string | null;
    coverImageUrl?: string | null;
    publishedAt?: Date | null;
    publishedById?: string | null;
  },
) {
  const updated = await db
    .update(events)
    .set(updates)
    .where(
      and(eq(events.id, eventId), eq(events.organizationId, organizationId)),
    )
    .returning({
      id: events.id,
      organizationId: events.organizationId,
      name: events.name,
      location: events.location,
      description: events.description,
      startTimestamp: events.startTimestamp,
      duration: events.duration,
      rsvpLimit: events.rsvpLimit,
      rsvpDeadline: events.rsvpDeadline,
      visibility: events.visibility,
      accessibilityNotes: events.accessibilityNotes,
      links: events.links,
      coverImageUrl: events.coverImageUrl,
      publishedAt: events.publishedAt,
      publishedById: events.publishedById,
    });

  return updated.length > 0 ? updated[0] : null;
}

async function addRSVP(eventId: string, userId: string) {
  const [existing] = await db
    .select()
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
    .limit(1);
  if (existing) {
    return;
  }
  await db.insert(eventRsvps).values({
    eventId,
    userId,
  });
}

async function deleteRSVP(eventId: string, userId: string) {
  await db
    .delete(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));
}

async function findByUser(userId: string) {
  return await db
    .select({
      id: events.id,
      organizationId: events.organizationId,
      name: events.name,
      location: events.location,
      description: events.description,
      startTimestamp: events.startTimestamp,
      duration: events.duration,
      coverImageUrl: events.coverImageUrl,
    })
    .from(events)
    .innerJoin(eventRsvps, eq(eventRsvps.eventId, events.id))
    .where(eq(eventRsvps.userId, userId));
}

async function countRSVPs(eventId: string) {
  const result = await db
    .select({ count: count() })
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId));

  return result[0]?.count ?? 0;
}

async function addEventHosts(eventId: string, userIds: string[]) {
  const additions = userIds.map((userId) => ({
    eventId,
    userId,
  }));

  await db.insert(eventHosts).values(additions);
}

export const EventService = {
  create,
  deleteById,
  findById,
  listByOrganization,
  listByPublic,
  updateEvent,
  addRSVP,
  deleteRSVP,
  findByUser,
  countRSVPs,
  addEventHosts,
  insertSchema,
};

export default EventService;
