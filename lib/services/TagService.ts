import { tags } from "@/lib/schema";
import db from "@/lib/db";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

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

async function updateTag(tagId: string, organizationId: string, tag: string) {
  const result = await db
    .update(tags)
    .set({ tag })
    .where(and(eq(tags.tagId, tagId), eq(tags.organizationId, organizationId)))
    .returning({ tagId: tags.tagId });
  return result.length > 0;
}

async function deleteTag(tagId: string, organizationId: string) {
  const result = await db
    .delete(tags)
    .where(and(eq(tags.tagId, tagId), eq(tags.organizationId, organizationId)))
    .returning({ tagId: tags.tagId });
  return result.length > 0;
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

async function allBelongToOrg(tagIds: string[], organizationId: string) {
  if (tagIds.length === 0) return true;
  const rows = await db
    .select({ tagId: tags.tagId })
    .from(tags)
    .where(
      and(inArray(tags.tagId, tagIds), eq(tags.organizationId, organizationId)),
    );
  return rows.length === new Set(tagIds).size;
}

export const TagService = {
  createTag,
  updateTag,
  deleteTag,
  listTags,
  allBelongToOrg,
};
