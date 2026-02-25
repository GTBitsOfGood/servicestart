import { createInsertSchema } from "drizzle-orm/zod";
import { announcements } from "../schema";
import { z } from "zod";
import db from "../db";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, isNotNull, SQL } from "drizzle-orm";

const insertSchema = createInsertSchema(announcements).omit({
  id: true,
  publishedAt: true,
});

async function createAnnouncement(
  input: z.infer<typeof insertSchema> & { draft: boolean },
) {
  const id = randomUUID();
  const [createdAnnouncement] = await db
    .insert(announcements)
    .values({ ...input, id, publishedAt: input.draft ? null : new Date() })
    .returning({
      id: announcements.id,
      name: announcements.name,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
      publishedById: announcements.publishedById,
      organizationId: announcements.organizationId,
      isDraft: isNull(announcements.publishedAt) as SQL<boolean>,
    })
    .execute();

  if (!createdAnnouncement) {
    throw new Error("Failed to create announcement");
  }

  return createdAnnouncement;
}

async function listByOrganization(
  organizationId: string,
  onlyDrafts: boolean,
  { limit, offset }: { limit: number; offset: number },
) {
  return await db
    .select({
      id: announcements.id,
      name: announcements.name,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
      publishedById: announcements.publishedById,
      // https://github.com/drizzle-team/drizzle-orm/issues/1826
      isDraft: isNull(announcements.publishedAt) as SQL<boolean>,
    })
    .from(announcements)
    .where(
      and(
        eq(announcements.organizationId, organizationId),
        onlyDrafts
          ? isNull(announcements.publishedAt)
          : isNotNull(announcements.publishedAt),
      ),
    )
    .limit(limit)
    .offset(offset)
    .execute();
}

async function getById(id: string) {
  const announcement = await db
    .select({
      id: announcements.id,
      name: announcements.name,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
      publishedById: announcements.publishedById,
      organizationId: announcements.organizationId,
      // https://github.com/drizzle-team/drizzle-orm/issues/1826
      isDraft: isNull(announcements.publishedAt) as SQL<boolean>,
    })
    .from(announcements)
    .where(eq(announcements.id, id))
    // do this because we dont have uncheckedIndexAccess on in
    // tsconfig, and this return type should be nullable
    .then((r) => r.at(0));

  return announcement;
}

async function updateAnnouncement({
  id,
  organizationId,
  userId,
  name,
  body,
  draft,
}: {
  id: string;
  organizationId: string;
  userId: string;
  name: string | undefined;
  body: string | undefined;
  draft: boolean | undefined;
}) {
  const [updatedAnnouncement] = await db
    .update(announcements)
    .set({
      name,
      body,
      // undefined is ignored (e.g. not updated). we set it to unpublished
      // when draft is false, and publish it when draft is true.
      publishedAt: draft === undefined ? undefined : draft ? new Date() : null,
      publishedById: draft === undefined ? undefined : draft ? userId : null,
    })
    .where(
      and(
        eq(announcements.id, id),
        eq(announcements.organizationId, organizationId),
      ),
    )
    .returning({
      id: announcements.id,
      name: announcements.name,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
      publishedById: announcements.publishedById,
      organizationId: announcements.organizationId,
      // https://github.com/drizzle-team/drizzle-orm/issues/1826
      isDraft: isNull(announcements.publishedAt) as SQL<boolean>,
    })
    .execute();

  if (!updatedAnnouncement) {
    return undefined;
  }

  return updatedAnnouncement;
}

async function deleteAnnouncement(id: string, organizationId: string) {
  const deleted = await db
    .delete(announcements)
    .where(
      and(
        eq(announcements.id, id),
        eq(announcements.organizationId, organizationId),
      ),
    )
    .returning({
      id: announcements.id,
      name: announcements.name,
      body: announcements.body,
      publishedAt: announcements.publishedAt,
      publishedById: announcements.publishedById,
      organizationId: announcements.organizationId,
      // https://github.com/drizzle-team/drizzle-orm/issues/1826
      isDraft: isNull(announcements.publishedAt) as SQL<boolean>,
    })
    .execute();

  return deleted;
}

export const AnnouncementsService = {
  insertSchema,
  createAnnouncement,
  listByOrganization,
  getById,
  updateAnnouncement,
  deleteAnnouncement,
};
