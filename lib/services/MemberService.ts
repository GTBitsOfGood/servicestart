import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import db from "@/lib/db";
import {
  events,
  eventRsvps,
  members,
  shifts,
  shiftRSVPs,
  users,
} from "@/lib/schema";

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

export const MembersService = {
  findByUserAndOrganization,
  getMemberActivity,
  getUserIdsByOrganization,
  isAdminOrOwner,
  listMemberContacts,
  listMembers,
  countByOrganization,
};
