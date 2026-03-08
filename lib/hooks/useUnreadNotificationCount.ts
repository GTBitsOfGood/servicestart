"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import authClient from "@/lib/authClient";

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
  const [isLoading, setIsLoading] = useState(false);

  const canFetch = !!session.data && !!organization.data?.id;

  useEffect(() => {
    if (!canFetch) return;

    const controller = new AbortController();
    Promise.resolve().then(() => setIsLoading(true));

    api.notifications.unreadCount
      .$get({}, { init: { signal: controller.signal } })
      .then(async (res) => {
        if (!res.ok) {
          setCount(0);
          return;
        }
        const json = await res.json();
        setCount(parseCount(json));
      })
      .catch(() => {
        setCount(0);
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [canFetch]);

  return {
    count: canFetch ? count : 0,
    isLoading: canFetch ? isLoading : false,
  };
}
