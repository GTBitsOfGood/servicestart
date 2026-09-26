"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import authClient from "@/lib/authClient";
import {
  UNREAD_NOTIFICATION_COUNT_CHANGED,
  type UnreadNotificationCountChangedDetail,
} from "@/lib/notificationEvents";

type UseUnreadNotificationCountResult = {
  count: number;
  isLoading: boolean;
};

function parseCount(value: unknown): number {
  if (!value || typeof value !== "object" || !("count" in value)) return 0;
  return Number((value as Record<string, unknown>).count ?? 0);
}

export function useUnreadNotificationCount(): UseUnreadNotificationCountResult {
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();

  const [count, setCount] = useState(0);
  const [countOrganizationId, setCountOrganizationId] = useState<
    string | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);

  const userId = session.data?.user?.id;
  const organizationId = organization.data?.id;
  const canFetch = !!userId && !!organizationId;

  useEffect(() => {
    if (!organizationId) return;

    const handleCountChanged = (event: Event) => {
      const { count: nextCount, organizationId: eventOrganizationId } = (
        event as CustomEvent<UnreadNotificationCountChangedDetail>
      ).detail;

      if (eventOrganizationId === organizationId) {
        setCount(nextCount);
        setCountOrganizationId(eventOrganizationId);
      }
    };

    window.addEventListener(
      UNREAD_NOTIFICATION_COUNT_CHANGED,
      handleCountChanged,
    );

    return () => {
      window.removeEventListener(
        UNREAD_NOTIFICATION_COUNT_CHANGED,
        handleCountChanged,
      );
    };
  }, [organizationId]);

  useEffect(() => {
    if (!canFetch) return;

    const controller = new AbortController();
    Promise.resolve().then(() => setIsLoading(true));

    api.notifications.unreadCount
      .$get({}, { init: { signal: controller.signal } })
      .then(async (res) => {
        if (!res.ok) {
          setCount(0);
          setCountOrganizationId(organizationId);
          return;
        }
        const json = await res.json();
        setCount(parseCount(json));
        setCountOrganizationId(organizationId);
      })
      .catch(() => {
        setCount(0);
        setCountOrganizationId(organizationId);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [canFetch, organizationId, userId]);

  return {
    count: canFetch && countOrganizationId === organizationId ? count : 0,
    isLoading: canFetch ? isLoading : false,
  };
}
