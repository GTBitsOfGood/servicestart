import "server-only";
import { and, eq } from "drizzle-orm";
import db from "@/core/db";
import { members } from "@/core/db/schema";

/*
 * The membership lookup the auth guards need. It lives in core so the guards
 * don't import the membership context; MembersService delegates to it.
 */

/** The user's membership in the organization, or null. */
export async function findMembership(userId: string, organizationId: string) {
  const [membership] = await db
    .select({
      id: members.id,
      role: members.role,
      memberType: members.memberType,
    })
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

const ADMIN_ROLES = ["admin", "owner"];

export function isAdminOrOwner(role: string | undefined): boolean {
  return role !== undefined && ADMIN_ROLES.includes(role);
}
