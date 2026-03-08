import api from "@/lib/api";
import type { NotificationType } from "@/lib/schema";

export type ReadFilter = "all" | "read" | "unread";

export async function fetchNotifications(
  read: ReadFilter,
  type?: NotificationType,
) {
  const response = await api.notifications.$get({
    query: { read, pageSize: "50", type },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  const json = await response.json();
  return json.data ?? [];
}

export async function fetchUnreadCount() {
  const response = await api.notifications.unreadCount.$get({});

  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }

  const json = await response.json();
  return Number(json.count ?? 0);
}
