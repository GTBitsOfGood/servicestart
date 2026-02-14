import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import db from "@/lib/db";
import { media } from "@/lib/schema";
import type { InferInsertModel } from "drizzle-orm";

export type MediaInsertInput = InferInsertModel<typeof media>;

async function create(input: Omit<MediaInsertInput, "id" | "uploadedAt">) {
  const id = randomUUID();
  const [created] = await db
    .insert(media)
    .values({
      id,
      ...input,
    })
    .returning();

  return created;
}

async function listByOrganization(
  organizationId: string,
  opts: { limit: number; offset: number },
) {
  return db
    .select()
    .from(media)
    .where(eq(media.organizationId, organizationId))
    .orderBy(asc(media.uploadedAt))
    .limit(opts.limit)
    .offset(opts.offset);
}

async function findById(id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);

  return row ?? null;
}

async function update(
  id: string,
  organizationId: string,
  updates: { title?: string; altText?: string },
) {
  const [updated] = await db
    .update(media)
    .set(updates)
    .where(and(eq(media.id, id), eq(media.organizationId, organizationId)))
    .returning();

  return updated ?? null;
}

async function deleteById(id: string, organizationId: string) {
  const [deleted] = await db
    .delete(media)
    .where(and(eq(media.id, id), eq(media.organizationId, organizationId)))
    .returning();

  return deleted ?? null;
}

export const MediaService = {
  create,
  listByOrganization,
  findById,
  update,
  deleteById,
};
