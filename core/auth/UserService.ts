import "server-only";
import { and, eq } from "drizzle-orm";
import db from "@/core/db";
import { users } from "@/core/auth/schema";

async function findById(id: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

async function findByEmailAndOrganization(
  email: string,
  organizationId: string,
) {
  return db
    .select()
    .from(users)
    .where(
      and(eq(users.email, email), eq(users.organizationId, organizationId)),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export const UserService = {
  findById,
  findByEmailAndOrganization,
};
