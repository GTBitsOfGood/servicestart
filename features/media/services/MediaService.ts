import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import db from "@/core/db";
import { media, members, users } from "@/core/db/schema";
import { alias } from "drizzle-orm/pg-core";
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

async function findById(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

/**
 * user.image is shared across that user's memberships. Only the owner may
 * follow their assigned profile image across tenants, and only while still a
 * member of both the current organization and the image's storage organization.
 * Library reads continue to use findById(id, organizationId).
 */
async function findOwnProfileImage(
  id: string,
  organizationId: string,
  userId: string,
) {
  const currentMembership = alias(members, "profile_current_membership");
  const sourceMembership = alias(members, "profile_source_membership");
  const [row] = await db
    .select({ organizationId: media.organizationId, fileName: media.fileName })
    .from(media)
    .innerJoin(
      users,
      and(eq(users.id, userId), eq(users.image, `/images/${id}`)),
    )
    .innerJoin(
      currentMembership,
      and(
        eq(currentMembership.userId, users.id),
        eq(currentMembership.organizationId, organizationId),
      ),
    )
    .innerJoin(
      sourceMembership,
      and(
        eq(sourceMembership.userId, users.id),
        eq(sourceMembership.organizationId, media.organizationId),
      ),
    )
    .where(eq(media.id, id))
    .limit(1);
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
  findOwnProfileImage,
  update,
  deleteById,
};
