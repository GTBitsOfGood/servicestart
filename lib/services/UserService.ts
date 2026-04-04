import { eq } from "drizzle-orm";
import { users } from "../schema";
import db from "../db";

async function findById(id: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

async function findByEmail(email: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export const UserService = {
  findById,
  findByEmail,
};
