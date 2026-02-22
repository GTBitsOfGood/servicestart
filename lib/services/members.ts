import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { members, users } from "@/lib/schema";

async function findByUserAndOrganization(
  userId: string,
  organizationId: string,
) {
  const [membership] = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationId),
      ),
    )
    .limit(1);

  return membership ?? null;
}

function isAdminOrOwner(role: string | undefined): boolean {
  const ADMIN_ROLES = ["admin", "owner"];
  return role !== undefined && ADMIN_ROLES.includes(role);
}

async function listMemberContacts(organizationId: string) {
  const rows = await db
    .select({ email: users.email, name: users.name })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, organizationId));

  const contactsByEmail = new Map<string, { email: string; name: string }>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email) continue;

    contactsByEmail.set(email, { email, name: row.name });
  }

  return Array.from(contactsByEmail.values());
}

export const MembersService = {
  findByUserAndOrganization,
  isAdminOrOwner,
  listMemberContacts,
};
