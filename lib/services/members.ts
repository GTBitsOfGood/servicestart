import { and, eq } from "drizzle-orm";
import db from "@/lib/db";
import { members } from "@/lib/schema";

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

export const MembersService = {
  findByUserAndOrganization,
  isAdminOrOwner,
};
