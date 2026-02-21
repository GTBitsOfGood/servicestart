import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import db from "@/lib/db";
import { members, notifications } from "@/lib/schema";

const ADMIN_ROLES = ["admin", "owner"] as const;

async function createForUserIds(
  userIds: string[],
  organizationId: string,
  text: string,
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
    text,
  }));

  return db.insert(notifications).values(values).returning({
    id: notifications.id,
    userId: notifications.userId,
    organizationId: notifications.organizationId,
    createdAt: notifications.createdAt,
    read: notifications.read,
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
  const organizationMembers = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.organizationId, organizationId));

  const userIds = organizationMembers.map((member) => member.userId);
  return createForUserIds(userIds, organizationId, text);
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
      text: notifications.text,
    });

  return updated ?? null;
}

export const NotificationService = {
  notify,
  notifyAdmins,
  notifyAllMembers,
  updateReadStatus,
};

export default NotificationService;
