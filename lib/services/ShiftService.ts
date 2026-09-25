import { and, count, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import db from "@/lib/db";
import { events, members, shifts, shiftRSVPs } from "@/lib/schema";
import { canViewEvent, deadlineBlock, publicationBlock } from "@/lib/events";
import { createShiftSchema, updateShiftSchema, ShiftError } from "@/lib/shifts";
import { MembersService } from "@/lib/services/MemberService";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Database = typeof db | Transaction;
type CreateShiftInput = z.input<typeof createShiftSchema>;
type UpdateShiftInput = z.input<typeof updateShiftSchema>;

const shiftScope = (shiftId: string, organizationId: string) =>
  and(eq(shifts.id, shiftId), eq(shifts.organizationId, organizationId));

async function viewerFor(
  database: Database,
  organizationId: string,
  actorId: string,
) {
  const [membership] = await database
    .select()
    .from(members)
    .where(
      and(
        eq(members.userId, actorId),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!membership) throw new ShiftError("forbidden");
  return {
    organizationId,
    isMember: true,
    isAdmin: MembersService.isAdminOrOwner(membership.role),
  };
}

async function findById(
  shiftId: string,
  organizationId: string,
  actorId: string,
) {
  const viewer = await viewerFor(db, organizationId, actorId);
  const [row] = await db
    .select({ shift: shifts, event: events })
    .from(shifts)
    .innerJoin(
      events,
      and(
        eq(events.id, shifts.eventId),
        eq(events.organizationId, organizationId),
      ),
    )
    .where(shiftScope(shiftId, organizationId))
    .limit(1);
  return row && canViewEvent(row.event, viewer) ? row.shift : null;
}

// Event deletes cascade to shifts. Lock parents before children, including both
// parents in ID order when reassigning a shift, to avoid lock inversions.
async function lockShift(
  tx: Transaction,
  shiftId: string,
  organizationId: string,
  replacementEventId?: string,
) {
  const [initial] = await tx
    .select({ eventId: shifts.eventId })
    .from(shifts)
    .where(shiftScope(shiftId, organizationId))
    .limit(1);
  if (!initial) throw new ShiftError("not-visible");
  const parentIds = Array.from(
    new Set([
      initial.eventId,
      ...(replacementEventId ? [replacementEventId] : []),
    ]),
  );
  const parents = await tx
    .select()
    .from(events)
    .where(
      and(
        inArray(events.id, parentIds),
        eq(events.organizationId, organizationId),
      ),
    )
    .orderBy(events.id)
    .for("update");
  if (parents.length !== parentIds.length) throw new ShiftError("not-visible");
  const [shift] = await tx
    .select()
    .from(shifts)
    .where(shiftScope(shiftId, organizationId))
    .for("update")
    .limit(1);
  if (!shift) throw new ShiftError("not-visible");
  if (shift.eventId !== initial.eventId) throw new ShiftError("shift-changed");
  return { shift, event: parents.find((event) => event.id === shift.eventId)! };
}

async function createShift(
  organizationId: string,
  actorId: string,
  input: CreateShiftInput,
) {
  const data = createShiftSchema.parse(input);
  return db.transaction(async (tx) => {
    const viewer = await viewerFor(tx, organizationId, actorId);
    if (!viewer.isAdmin) throw new ShiftError("forbidden");
    const [event] = await tx
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.id, data.eventId),
          eq(events.organizationId, organizationId),
        ),
      )
      .for("update")
      .limit(1);
    if (!event) throw new ShiftError("not-visible");
    const [shift] = await tx
      .insert(shifts)
      .values({
        ...data,
        id: randomUUID(),
        organizationId,
        name: data.name ?? "",
        description: data.description ?? "",
        startTimestamp: new Date(data.startTimestamp),
        rsvpLimit: data.rsvpLimit ?? null,
      })
      .returning();
    return shift;
  });
}

async function updateShift(
  shiftId: string,
  organizationId: string,
  actorId: string,
  input: UpdateShiftInput,
) {
  const data = updateShiftSchema.parse(input);
  return db.transaction(async (tx) => {
    const viewer = await viewerFor(tx, organizationId, actorId);
    if (!viewer.isAdmin) throw new ShiftError("forbidden");
    await lockShift(tx, shiftId, organizationId, data.eventId);
    if (data.rsvpLimit != null) {
      const [{ value }] = await tx
        .select({ value: count() })
        .from(shiftRSVPs)
        .where(eq(shiftRSVPs.shiftId, shiftId));
      if (data.rsvpLimit < value) throw new ShiftError("capacity-too-small");
    }
    const [updated] = await tx
      .update(shifts)
      .set({
        ...data,
        startTimestamp:
          data.startTimestamp === undefined
            ? undefined
            : new Date(data.startTimestamp),
      })
      .where(shiftScope(shiftId, organizationId))
      .returning();
    return updated;
  });
}

async function deleteById(
  shiftId: string,
  organizationId: string,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const viewer = await viewerFor(tx, organizationId, actorId);
    if (!viewer.isAdmin) throw new ShiftError("forbidden");
    await lockShift(tx, shiftId, organizationId);
    const [deleted] = await tx
      .delete(shifts)
      .where(shiftScope(shiftId, organizationId))
      .returning();
    return deleted;
  });
}

async function registrationContext(
  tx: Transaction,
  shiftId: string,
  organizationId: string,
  actorId: string,
  userId: string,
) {
  const viewer = await viewerFor(tx, organizationId, actorId);
  const context = await lockShift(tx, shiftId, organizationId);
  if (!canViewEvent(context.event, viewer)) throw new ShiftError("not-visible");
  if (userId !== actorId && !viewer.isAdmin) throw new ShiftError("forbidden");
  const [target] = await tx
    .select({ id: members.id })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!target) throw new ShiftError("not-a-member");
  return context;
}

async function register(
  shiftId: string,
  organizationId: string,
  actorId: string,
  userId = actorId,
  now?: Date,
) {
  return db.transaction(async (tx) => {
    const { shift, event } = await registrationContext(
      tx,
      shiftId,
      organizationId,
      actorId,
      userId,
    );
    const publication = publicationBlock(event);
    if (publication) throw new ShiftError(publication);
    const [existing] = await tx
      .select({ userId: shiftRSVPs.userId })
      .from(shiftRSVPs)
      .where(
        and(eq(shiftRSVPs.shiftId, shiftId), eq(shiftRSVPs.userId, userId)),
      )
      .limit(1);
    if (existing) return "already-registered" as const;
    const deadline = deadlineBlock(event, now ?? new Date());
    if (deadline) throw new ShiftError(deadline);
    if (shift.rsvpLimit !== null) {
      const [{ value }] = await tx
        .select({ value: count() })
        .from(shiftRSVPs)
        .where(eq(shiftRSVPs.shiftId, shiftId));
      if (value >= shift.rsvpLimit) throw new ShiftError("full");
    }
    await tx.insert(shiftRSVPs).values({ shiftId, userId });
    return "added" as const;
  });
}

async function withdraw(
  shiftId: string,
  organizationId: string,
  actorId: string,
  userId = actorId,
  now?: Date,
) {
  return db.transaction(async (tx) => {
    const { event } = await registrationContext(
      tx,
      shiftId,
      organizationId,
      actorId,
      userId,
    );
    const deadline = deadlineBlock(event, now ?? new Date());
    if (deadline) throw new ShiftError(deadline);
    await tx
      .delete(shiftRSVPs)
      .where(
        and(eq(shiftRSVPs.shiftId, shiftId), eq(shiftRSVPs.userId, userId)),
      );
    return "removed" as const;
  });
}

async function listByEvent(
  eventId: string,
  organizationId: string,
  options: { limit: number; offset: number },
  actorId: string,
) {
  const viewer = await viewerFor(db, organizationId, actorId);
  const [event] = await db
    .select()
    .from(events)
    .where(
      and(eq(events.id, eventId), eq(events.organizationId, organizationId)),
    )
    .limit(1);
  if (!event || !canViewEvent(event, viewer))
    throw new ShiftError("not-visible");
  return db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.eventId, eventId),
        eq(shifts.organizationId, organizationId),
      ),
    )
    .orderBy(shifts.id)
    .limit(options.limit)
    .offset(options.offset);
}

export const ShiftService = {
  createShift,
  updateShift,
  findById,
  deleteById,
  register,
  withdraw,
  listByEvent,
};
export default ShiftService;
