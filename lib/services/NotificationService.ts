import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import db from "@/lib/db";
import { notifications, NotificationType, members } from "@/lib/schema";
import { MembersService } from "@/lib/services/MemberService";

const ADMIN_ROLES = ["admin", "owner"];

export type NotificationReadFilter = "all" | "read" | "unread";

async function createForUserIds(
  userIds: string[],
  organizationId: string,
  text: string,
  type: NotificationType = NotificationType.General,
) {
  if (userIds.length === 0) {
    return [];
  }

  const uniqueUserIds = userIds.filter(
    (userId, index) => userIds.indexOf(userId) === index,
  );

  const values = uniqueUserIds.map((userId) => ({
    id: randomUUID(),
    userId,
    organizationId,
    type,
    text,
  }));

  return db.insert(notifications).values(values).returning({
    id: notifications.id,
    userId: notifications.userId,
    organizationId: notifications.organizationId,
    createdAt: notifications.createdAt,
    read: notifications.read,
    type: notifications.type,
    text: notifications.text,
  });
}

async function notify(userId: string, orgId: string, text: string) {
  const [notification] = await createForUserIds([userId], orgId, text);
  return notification ?? null;
}

async function notifyAdmins(organizationId: string, text: string) {
  const adminMembers = await db
    .select({ userId: members.userId })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        inArray(members.role, [...ADMIN_ROLES]),
      ),
    );

  const userIds = adminMembers.map((member) => member.userId);
  return createForUserIds(userIds, organizationId, text);
}

async function notifyAllMembers(organizationId: string, text: string) {
  const userIds = await MembersService.getUserIdsByOrganization(organizationId);
  return createForUserIds(userIds, organizationId, text);
}

async function listByUserAndOrganization(
  userId: string,
  organizationId: string,
  read: NotificationReadFilter,
  type: NotificationType | undefined,
  options: { limit: number; offset: number },
) {
  const conditions = [
    eq(notifications.userId, userId),
    eq(notifications.organizationId, organizationId),
  ];

  if (read === "read") {
    conditions.push(eq(notifications.read, true));
  }

  if (read === "unread") {
    conditions.push(eq(notifications.read, false));
  }

  if (type) {
    conditions.push(eq(notifications.type, type));
  }

  return db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      organizationId: notifications.organizationId,
      createdAt: notifications.createdAt,
      read: notifications.read,
      type: notifications.type,
      text: notifications.text,
    })
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit)
    .offset(options.offset);
}

async function countByUserAndOrganization(
  userId: string,
  organizationId: string,
  read: boolean,
  type: NotificationType | undefined,
) {
  const conditions = [
    eq(notifications.userId, userId),
    eq(notifications.organizationId, organizationId),
    eq(notifications.read, read),
  ];

  if (type) {
    conditions.push(eq(notifications.type, type));
  }

  const [row] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(...conditions));

  return Number(row?.count ?? 0);
}

async function findById(notificationId: string) {
  const [notification] = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      organizationId: notifications.organizationId,
      createdAt: notifications.createdAt,
      read: notifications.read,
      type: notifications.type,
      text: notifications.text,
    })
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  return notification ?? null;
}

async function updateReadStatus(notificationId: string, status: boolean) {
  const [updated] = await db
    .update(notifications)
    .set({ read: status })
    .where(eq(notifications.id, notificationId))
    .returning({
      id: notifications.id,
      userId: notifications.userId,
      organizationId: notifications.organizationId,
      createdAt: notifications.createdAt,
      read: notifications.read,
      type: notifications.type,
      text: notifications.text,
    });

  return updated ?? null;
}

async function markAllRead(userId: string, organizationId: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.organizationId, organizationId),
        eq(notifications.read, false),
      ),
    );
}

async function deleteNotification(notificationId: string) {
  const [deleted] = await db
    .delete(notifications)
    .where(eq(notifications.id, notificationId))
    .returning({ id: notifications.id });

  return deleted ?? null;
}

export const NotificationService = {
  notify,
  notifyAdmins,
  notifyAllMembers,
  listByUserAndOrganization,
  countByUserAndOrganization,
  findById,
  updateReadStatus,
  markAllRead,
  deleteNotification,
};

export default NotificationService;
