import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { organizations } from "@/lib/schema";

async function findBySlug(slug: string) {
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  return organization ?? null;
}

async function findById(id: string) {
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  return organization ?? null;
}

export const OrganizationsService = {
  findBySlug,
  findById,
};
