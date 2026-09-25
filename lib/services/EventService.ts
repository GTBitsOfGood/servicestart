import {
  and,
  count,
  eq,
  gt,
  lt,
  isNull,
  isNotNull,
  ilike,
  or,
} from "drizzle-orm";
import db from "@/lib/db";
import {
  events,
  eventRsvps,
  eventTags,
  eventHosts,
  EventVisibility,
  members,
  tags,
} from "@/lib/schema";
import type { RegistrationBlock } from "@/lib/events";
import { randomUUID } from "node:crypto";

export type RegisterResult = "added" | "already-registered" | RegistrationBlock;

export type WithdrawResult = "removed" | RegistrationBlock;

async function create(
  organizationId: string,
  name: string,
  location: string,
  startTimestamp: Date | null,
  duration: string | null,
  description: string | null,
  coverImageUrl: string | null,
  rsvpLimit: number | null,
  rsvpDeadline: Date | null,
  visibility: EventVisibility,
  accessibilityNotes: string | null,
  links: string[] | null,
  publishedAt?: Date | null,
  publishedById?: string | null,
  tagIds?: string[],
) {
  const id = randomUUID();

  const [event] = await db
    .insert(events)
    .values({
      id,
      organizationId,
      name,
      location,
      description,
      startTimestamp,
      duration,
      rsvpLimit,
      rsvpDeadline,
      visibility,
      accessibilityNotes,
      links,
      coverImageUrl,
      publishedAt,
      publishedById,
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
  if (tagIds && tagIds.length > 0) {
    await db
      .insert(eventTags)
      .values(tagIds.map((tagId) => ({ eventId: event.id, tagId })));
  }

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
  const rows = await db
    .select({
      event: events,
      tag: tags,
    })
    .from(events)
    .leftJoin(eventTags, eq(eventTags.eventId, events.id))
    .leftJoin(tags, eq(tags.tagId, eventTags.tagId))
    .where(eq(events.id, eventId));

  if (rows.length === 0) return null;

  const eventTagList = rows.flatMap((row) => (row.tag ? [row.tag] : []));

  return { ...rows[0].event, tags: eventTagList };
}

async function listByOrganization(
  organizationId: string,
  options: { limit: number; offset: number },
  {
    published,
    query,
    filter,
  }: {
    published?: boolean;
    query?: string;
    filter?: string;
  },
) {
  const conditions = [eq(events.organizationId, organizationId)];
  if (published !== undefined) {
    conditions.push(
      published ? isNotNull(events.publishedAt) : isNull(events.publishedAt),
    );
  }
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      or(ilike(events.name, pattern), ilike(events.location, pattern))!,
    );
  }
  if (filter === "upcoming") {
    conditions.push(gt(events.startTimestamp, new Date()));
  } else if (filter === "past") {
    conditions.push(lt(events.startTimestamp, new Date()));
  } else if (filter === "drafts") {
    conditions.push(isNull(events.publishedAt));
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
    .where(
      and(
        eq(events.visibility, EventVisibility.Public),
        isNotNull(events.publishedAt),
      ),
    )
    .limit(options.limit)
    .offset(options.offset);
}

const eventColumns = {
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
};

// Same shape as updateEvent, so a no-op update can answer with the stored row.
async function findEventRow(eventId: string, organizationId: string) {
  const [row] = await db
    .select(eventColumns)
    .from(events)
    .where(
      and(eq(events.id, eventId), eq(events.organizationId, organizationId)),
    )
    .limit(1);

  return row ?? null;
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
    rsvpLimit?: number | null;
    rsvpDeadline?: Date | null;
    visibility?: EventVisibility;
    accessibilityNotes?: string | null;
    links?: string[] | null;
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

// Every registration rule lives here so the API route and the page action
// cannot disagree. The event row is locked so capacity holds under concurrency.
async function register(
  eventId: string,
  organizationId: string,
  userId: string,
  now: Date = new Date(),
): Promise<RegisterResult> {
  return await db.transaction(async (tx) => {
    const [event] = await tx
      .select({
        publishedAt: events.publishedAt,
        rsvpLimit: events.rsvpLimit,
        rsvpDeadline: events.rsvpDeadline,
      })
      .from(events)
      .where(
        and(eq(events.id, eventId), eq(events.organizationId, organizationId)),
      )
      .for("update")
      .limit(1);

    if (!event) return "not-visible";

    const [membership] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.userId, userId),
          eq(members.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!membership) return "not-a-member";
    if (event.publishedAt == null) return "unpublished";

    const [existing] = await tx
      .select({ userId: eventRsvps.userId })
      .from(eventRsvps)
      .where(
        and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)),
      )
      .limit(1);

    if (existing) return "already-registered";

    if (event.rsvpDeadline && now.getTime() >= event.rsvpDeadline.getTime()) {
      return "deadline-passed";
    }

    if (event.rsvpLimit !== null) {
      const [{ value: rsvpCount }] = await tx
        .select({ value: count() })
        .from(eventRsvps)
        .where(eq(eventRsvps.eventId, eventId));

      if (rsvpCount >= event.rsvpLimit) return "full";
    }

    await tx.insert(eventRsvps).values({ eventId, userId });

    return "added";
  });
}

// Withdrawal closes at the deadline, the same moment registration closes.
async function withdraw(
  eventId: string,
  organizationId: string,
  userId: string,
  now: Date = new Date(),
): Promise<WithdrawResult> {
  const [event] = await db
    .select({ rsvpDeadline: events.rsvpDeadline })
    .from(events)
    .where(
      and(eq(events.id, eventId), eq(events.organizationId, organizationId)),
    )
    .limit(1);

  if (!event) return "not-visible";

  const [membership] = await db
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!membership) return "not-a-member";

  if (event.rsvpDeadline && now.getTime() >= event.rsvpDeadline.getTime()) {
    return "deadline-passed";
  }

  await db
    .delete(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));

  return "removed";
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
      rsvpLimit: events.rsvpLimit,
      rsvpDeadline: events.rsvpDeadline,
      visibility: events.visibility,
      accessibilityNotes: events.accessibilityNotes,
      links: events.links,
      publishedAt: events.publishedAt,
      publishedById: events.publishedById,
    })
    .from(events)
    .innerJoin(eventRsvps, eq(eventRsvps.eventId, events.id))
    .where(eq(eventRsvps.userId, userId));
}

async function listRSVPsByEvent(eventId: string) {
  return await db
    .select({
      eventId: eventRsvps.eventId,
      userId: eventRsvps.userId,
    })
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId));
}

async function addEventHosts(eventId: string, userIds: string[]) {
  const additions = userIds.map((userId) => ({
    eventId,
    userId,
  }));

  await db.insert(eventHosts).values(additions);
}

async function listEventHosts(eventId: string) {
  return await db
    .select({ eventId: eventHosts.eventId, userId: eventHosts.userId })
    .from(eventHosts)
    .where(eq(eventHosts.eventId, eventId));
}

async function setEventHosts(eventId: string, userIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(eventHosts).where(eq(eventHosts.eventId, eventId));
    if (userIds.length === 0) return;
    const unique = Array.from(new Set(userIds));
    await tx
      .insert(eventHosts)
      .values(unique.map((userId) => ({ eventId, userId })));
  });
}

async function setEventTags(eventId: string, tagIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(eventTags).where(eq(eventTags.eventId, eventId));
    if (tagIds.length === 0) return;
    const unique = Array.from(new Set(tagIds));
    await tx
      .insert(eventTags)
      .values(unique.map((tagId) => ({ eventId, tagId })));
  });
}

async function countRSVPs(eventId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId));

  return value;
}

async function hasRSVP(eventId: string, userId: string) {
  const [existing] = await db
    .select({ userId: eventRsvps.userId })
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
    .limit(1);

  return existing !== undefined;
}

export const EventService = {
  create,
  deleteById,
  findById,
  listByOrganization,
  listByPublic,
  updateEvent,
  findEventRow,
  register,
  withdraw,
  findByUser,
  listRSVPsByEvent,
  addEventHosts,
  listEventHosts,
  setEventHosts,
  setEventTags,
  countRSVPs,
  hasRSVP,
};

export default EventService;
