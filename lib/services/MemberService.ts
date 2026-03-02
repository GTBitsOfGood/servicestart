import { and, eq, sql } from "drizzle-orm";
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

async function getUserIdsByOrganization(organizationId: string) {
  const organizationMembers = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.organizationId, organizationId));

  return organizationMembers.map((member) => member.userId);
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

async function listMembers(
  organizationId: string,
  { limit, offset }: { limit: number; offset: number },
) {
  return db
    .select({
      userId: members.userId,
      name: users.name,
      email: users.email,
      phoneNumber: users.phoneNumber,
      role: members.role,
      createdAt: members.createdAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, organizationId))
    .limit(limit)
    .offset(offset);
}

async function countByOrganization(organizationId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.organizationId, organizationId));
  return row?.count ?? 0;
}

export const MembersService = {
  findByUserAndOrganization,
  getUserIdsByOrganization,
  isAdminOrOwner,
  listMemberContacts,
  listMembers,
  countByOrganization,
};
