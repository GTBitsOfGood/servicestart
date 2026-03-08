"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type { NotificationListItem } from "@/components/notifications/NotificationItem";
import { fetchNotifications, fetchUnreadCount } from "@/lib/notifications";
import type { NotificationType } from "@/lib/schema";

export function useNotifications(filterType?: NotificationType) {
  const [allNotifications, setAllNotifications] = useState<
    NotificationListItem[]
  >([]);
  const [unreadNotifications, setUnreadNotifications] = useState<
    NotificationListItem[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkAllReadPending, setIsMarkAllReadPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const [all, unread, count] = await Promise.all([
      fetchNotifications("all", filterType),
      fetchNotifications("unread", filterType),
      fetchUnreadCount(),
    ]);

    setAllNotifications(all);
    setUnreadNotifications(unread);
    setUnreadCount(count);
  }, [filterType]);

  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadNotifications();
      setErrorMessage(null);
    } catch {
      setErrorMessage("Unable to refresh notifications.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadNotifications]);

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);

    loadNotifications()
      .catch(() => {
        setAllNotifications([]);
        setUnreadNotifications([]);
        setUnreadCount(0);
        setErrorMessage("Unable to load notifications.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [loadNotifications]);

  const runMutation = useCallback(
    async (mutation: () => Promise<Response>, failureMessage?: string) => {
      try {
        const response = await mutation();

        if (!response.ok) {
          throw new Error("Mutation failed");
        }

        await refreshNotifications();
      } catch {
        if (failureMessage) {
          setErrorMessage(failureMessage);
        }
      }
    },
    [refreshNotifications],
  );

  const handleMarkAllRead = useCallback(async () => {
    setIsMarkAllReadPending(true);
    setErrorMessage(null);

    await runMutation(
      () => api.notifications.markAllRead.$post({}),
      "Could not mark all notifications as read.",
    );

    setIsMarkAllReadPending(false);
  }, [runMutation]);

  const handleDelete = useCallback(
    (id: string) => {
      setErrorMessage(null);
      void runMutation(
        () => api.notifications[":id"].$delete({ param: { id } }),
        "Could not delete this notification.",
      );
    },
    [runMutation],
  );

  const handleToggleRead = useCallback(
    (id: string, read: boolean) => {
      setErrorMessage(null);
      void runMutation(
        () =>
          api.notifications[":id"].$patch({ param: { id }, json: { read } }),
        "Could not update this notification.",
      );
    },
    [runMutation],
  );

  return {
    allNotifications,
    unreadNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    isMarkAllReadPending,
    errorMessage,
    refreshNotifications,
    handleMarkAllRead,
    handleDelete,
    handleToggleRead,
  };
}
