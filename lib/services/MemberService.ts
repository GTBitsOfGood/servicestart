import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import db from "@/lib/db";
import {
  events,
  eventRsvps,
  members,
  MemberType,
  shifts,
  shiftRSVPs,
  users,
} from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

async function findByUserAndOrganization(
  userId: string,
  organizationId: string,
) {
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

async function isAdminOrderOwnerFromUserAndOrgId(
  userId: string | undefined | null,
  organizationId: string | undefined | null,
) {
  if (!userId || !organizationId) {
    return false;
  }

  return findByUserAndOrganization(userId, organizationId).then((membership) =>
    isAdminOrOwner(membership?.role),
  );
}

async function listMemberContacts(organizationId: string) {
  const rows = await db
    .select({ userId: members.userId, email: users.email, name: users.name })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.organizationId, organizationId));

  const contactsByEmail = new Map<
    string,
    { userId: string; email: string; name: string }
  >();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email) continue;

    contactsByEmail.set(email, { userId: row.userId, email, name: row.name });
  }

  return Array.from(contactsByEmail.values());
}

function memberFilter(organizationId: string, memberType?: MemberType) {
  return and(
    eq(members.organizationId, organizationId),
    memberType ? eq(members.memberType, memberType) : undefined,
  );
}

async function listMembers(
  organizationId: string,
  {
    limit,
    offset,
    memberType,
  }: { limit: number; offset: number; memberType?: MemberType },
) {
  return db
    .select({
      userId: members.userId,
      name: users.name,
      email: users.email,
      phoneNumber: users.phoneNumber,
      role: members.role,
      memberType: members.memberType,
      createdAt: members.createdAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(memberFilter(organizationId, memberType))
    .orderBy(members.id)
    .limit(limit)
    .offset(offset);
}

async function countByOrganization(
  organizationId: string,
  memberType?: MemberType,
) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members)
    .where(memberFilter(organizationId, memberType));
  return row?.count ?? 0;
}

/**
 * Sets the member type for one or more members of an organization. Writes
 * nothing unless every user ID is a non-admin member of the organization.
 */
async function setMemberTypes(
  organizationId: string,
  userIds: string[],
  memberType: MemberType,
): Promise<{ error: "not_found" | "admin" } | { updated: number }> {
  const uniqueIds = Array.from(new Set(userIds));

  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ userId: members.userId, role: members.role })
      .from(members)
      .where(
        and(
          eq(members.organizationId, organizationId),
          inArray(members.userId, uniqueIds),
        ),
      );

    if (rows.length < uniqueIds.length) return { error: "not_found" as const };
    if (rows.some((row) => isAdminOrOwner(row.role))) {
      return { error: "admin" as const };
    }

    const updated = await tx
      .update(members)
      .set({ memberType })
      .where(
        and(
          eq(members.organizationId, organizationId),
          inArray(members.userId, uniqueIds),
        ),
      )
      .returning({ id: members.id });

    return { updated: updated.length };
  });
}

/**
 * Adds a user who signed up (auto-approved or an approved join request) as a
 * plain member. Signup never grants admin.
 */
async function addSignupMember(userId: string, organizationId: string) {
  if (await findByUserAndOrganization(userId, organizationId)) return;

  const memberTypesEnabled =
    await OrganizationConfigService.getMemberTypesEnabled(organizationId);

  await db.insert(members).values({
    id: randomUUID(),
    userId,
    organizationId,
    role: "member",
    memberType: memberTypesEnabled ? MemberType.Applicant : null,
  });
}

async function getMemberActivity(
  userIds: string[],
  organizationId: string,
): Promise<Record<string, { totalHours: number; lastActive: string | null }>> {
  const now = new Date();

  const [eventActivity, shiftActivity] = await Promise.all([
    db
      .select({
        userId: eventRsvps.userId,
        totalSeconds: sql<number>`COALESCE(EXTRACT(EPOCH FROM SUM(${events.duration})), 0)`,
        lastActive: sql<Date | null>`MAX(${events.startTimestamp})`,
      })
      .from(eventRsvps)
      .innerJoin(events, eq(events.id, eventRsvps.eventId))
      .where(
        and(
          inArray(eventRsvps.userId, userIds),
          eq(events.organizationId, organizationId),
          isNotNull(events.startTimestamp),
          lt(events.startTimestamp, now),
          isNotNull(events.duration),
        ),
      )
      .groupBy(eventRsvps.userId),

    db
      .select({
        userId: shiftRSVPs.userId,
        totalSeconds: sql<number>`COALESCE(EXTRACT(EPOCH FROM SUM(${shifts.duration})), 0)`,
        lastActive: sql<Date | null>`MAX(${shifts.startTimestamp})`,
      })
      .from(shiftRSVPs)
      .innerJoin(shifts, eq(shifts.id, shiftRSVPs.shiftId))
      .where(
        and(
          inArray(shiftRSVPs.userId, userIds),
          eq(shifts.organizationId, organizationId),
          lt(shifts.startTimestamp, now),
        ),
      )
      .groupBy(shiftRSVPs.userId),
  ]);

  const activityMap = new Map<
    string,
    { totalSeconds: number; lastActive: Date | null }
  >();

  for (const row of eventActivity) {
    activityMap.set(row.userId, {
      totalSeconds: Number(row.totalSeconds),
      lastActive: row.lastActive,
    });
  }

  for (const row of shiftActivity) {
    const existing = activityMap.get(row.userId);
    const shiftSeconds = Number(row.totalSeconds);
    const shiftLastActive = row.lastActive;

    if (!existing) {
      activityMap.set(row.userId, {
        totalSeconds: shiftSeconds,
        lastActive: shiftLastActive,
      });
    } else {
      const mergedLastActive =
        existing.lastActive == null
          ? shiftLastActive
          : shiftLastActive == null
            ? existing.lastActive
            : existing.lastActive > shiftLastActive
              ? existing.lastActive
              : shiftLastActive;

      activityMap.set(row.userId, {
        totalSeconds: existing.totalSeconds + shiftSeconds,
        lastActive: mergedLastActive,
      });
    }
  }

  const result: Record<
    string,
    { totalHours: number; lastActive: string | null }
  > = {};
  for (const userId of userIds) {
    const entry = activityMap.get(userId);
    result[userId] = {
      totalHours: entry ? Math.round((entry.totalSeconds / 3600) * 10) / 10 : 0,
      lastActive: entry?.lastActive
        ? new Date(entry.lastActive).toISOString()
        : null,
    };
  }

  return result;
}
async function addMemberDirectly(
  email: string,
  name: string,
  organizationId: string,
  role: string = "member",
) {
  return await db.transaction(async (tx) => {
    const normalizedEmail = email.trim().toLowerCase();

    let [user] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, normalizedEmail),
          eq(users.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!user) {
      [user] = await tx
        .insert(users)
        .values({
          id: randomUUID(),
          name: name.trim() || "Unknown",
          email: normalizedEmail,
          organizationId,
        })
        .returning();
    }

    const existing = await findByUserAndOrganization(user.id, organizationId);
    if (existing) {
      throw new Error("User is already a member of this organization.");
    }

    const [newMember] = await tx
      .insert(members)
      .values({
        id: randomUUID(),
        userId: user.id,
        organizationId,
        role,
      })
      .returning();

    return newMember;
  });
}
export const MembersService = {
  findByUserAndOrganization,
  getMemberActivity,
  getUserIdsByOrganization,
  isAdminOrOwner,
  isAdminOrderOwnerFromUserAndOrgId,
  listMemberContacts,
  listMembers,
  countByOrganization,
  setMemberTypes,
  addSignupMember,
  addMemberDirectly,
};
