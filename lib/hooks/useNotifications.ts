"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import type { NotificationListItem } from "@/components/notifications/NotificationItem";
import { fetchNotifications, fetchUnreadCount } from "@/lib/notifications";
import type { NotificationType } from "@/lib/schema";
import authClient from "@/lib/authClient";
import { publishUnreadNotificationCount } from "@/lib/notificationEvents";

export function useNotifications(filterType?: NotificationType) {
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();
  const userId = session.data?.user?.id;
  const organizationId = organization.data?.id;
  const canFetch = !!userId && !!organizationId;
  const activeScopeRef = useRef({ userId, organizationId });
  const latestLoadIdRef = useRef(0);

  activeScopeRef.current = { userId, organizationId };

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

  const loadNotifications = useCallback(async (): Promise<boolean> => {
    if (!canFetch || !organizationId) {
      latestLoadIdRef.current += 1;
      setAllNotifications([]);
      setUnreadNotifications([]);
      setUnreadCount(0);
      return true;
    }

    const loadId = ++latestLoadIdRef.current;
    const loadUserId = userId;
    const loadOrganizationId = organizationId;
    let results: [NotificationListItem[], NotificationListItem[], number];

    try {
      results = await Promise.all([
        fetchNotifications("all", filterType),
        fetchNotifications("unread", filterType),
        fetchUnreadCount(),
      ]);
    } catch (error) {
      const activeScope = activeScopeRef.current;
      const isCurrentLoad =
        loadId === latestLoadIdRef.current &&
        activeScope.userId === loadUserId &&
        activeScope.organizationId === loadOrganizationId;

      if (!isCurrentLoad) return false;
      throw error;
    }

    const activeScope = activeScopeRef.current;
    const isCurrentLoad =
      loadId === latestLoadIdRef.current &&
      activeScope.userId === loadUserId &&
      activeScope.organizationId === loadOrganizationId;

    if (!isCurrentLoad) return false;

    const [all, unread, count] = results;

    setAllNotifications(all);
    setUnreadNotifications(unread);
    setUnreadCount(count);
    publishUnreadNotificationCount(count, organizationId);
    return true;
  }, [canFetch, filterType, organizationId, userId]);

  const refreshNotifications = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const didLoad = await loadNotifications();
      if (didLoad) setErrorMessage(null);
    } catch {
      setErrorMessage("Unable to refresh notifications.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadNotifications]);

  useEffect(() => {
    let isActive = true;

    if (!canFetch) {
      latestLoadIdRef.current += 1;
      setAllNotifications([]);
      setUnreadNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    loadNotifications()
      .catch(() => {
        if (!isActive) return;
        setAllNotifications([]);
        setUnreadNotifications([]);
        setUnreadCount(0);
        setErrorMessage("Unable to load notifications.");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [canFetch, loadNotifications]);

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
