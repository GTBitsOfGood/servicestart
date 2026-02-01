import { eq } from "drizzle-orm";
import db from "@/lib/db";
import { organizations } from "@/lib/schema";

async function findBySlug(slug: string) {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  return organization ?? null;
}

export const OrganizationsService = {
  findBySlug,
};
