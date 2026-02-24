import { shifts, shiftRSVPs } from "@/lib/schema";
import { InferInsertModel } from "drizzle-orm";
import db from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

type ShiftInsert = InferInsertModel<typeof shifts>;
type CreateShiftInput = Omit<ShiftInsert, "id">;
type UpdateShiftInput = Partial<Omit<CreateShiftInput, "organizationId">>;

async function createShift(body: CreateShiftInput) {
  const id = randomUUID();
  await db.insert(shifts).values({
    id,
    ...body,
  });

  const shift = await findById(id);
  return shift;
}

export async function updateShift(shiftId: string, body: UpdateShiftInput) {
  await db.update(shifts).set(body).where(eq(shifts.id, shiftId));
}

async function findById(shiftId: string) {
  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  return shift[0] ?? null;
}

async function deleteById(shiftId: string) {
  const shift = await findById(shiftId);
  if (!shift) {
    return null;
  }

  await db.delete(shifts).where(eq(shifts.id, shiftId));

  return shift;
}

async function addRSVP(shiftId: string, userId: string) {
  await db.insert(shiftRSVPs).values({
    shiftId,
    userId,
  });
}

async function deleteRSVP(shiftId: string, userId: string) {
  await db
    .delete(shiftRSVPs)
    .where(and(eq(shiftRSVPs.shiftId, shiftId), eq(shiftRSVPs.userId, userId)));
}

async function listByEvent(
  eventId: string,
  organizationId: string,
  options: { limit: number; offset: number },
) {
  return await db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.eventId, eventId),
        eq(shifts.organizationId, organizationId),
      ),
    )
    .limit(options.limit)
    .offset(options.offset);
}

export const ShiftService = {
  createShift,
  updateShift,
  findById,
  deleteById,
  addRSVP,
  deleteRSVP,
  listByEvent,
};

export default ShiftService;
