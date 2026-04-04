import { tags } from "@/lib/schema";
import db from "@/lib/db";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

async function createTag(organizationId: string, tag: string) {
  const [tagRecord] = await db
    .insert(tags)
    .values({
      tag,
      organizationId,
      tagId: randomUUID(),
    })
    .returning({
      tagId: tags.tagId,
    });

  return tagRecord;
}

async function updateTag(tagId: string, tag: string) {
  await db.update(tags).set({ tag }).where(eq(tags.tagId, tagId));
}

async function deleteTag(tagId: string) {
  await db.delete(tags).where(eq(tags.tagId, tagId));
}

async function listTags(organizationId: string) {
  return await db
    .select({
      tagId: tags.tagId,
      tag: tags.tag,
    })
    .from(tags)
    .where(eq(tags.organizationId, organizationId));
}

export const TagService = {
  createTag,
  updateTag,
  deleteTag,
  listTags,
};
