"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import authClient from "@/lib/authClient";

type UseUnreadNotificationCountResult = {
  count: number;
  isLoading: boolean;
};

export function useUnreadNotificationCount(): UseUnreadNotificationCountResult {
  const session = authClient.useSession();

  const activeOrganizationId = useMemo(() => {
    const data = session.data as
      | { session?: { activeOrganizationId?: string | null } }
      | undefined;
    return data?.session?.activeOrganizationId ?? null;
  }, [session.data]);

  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const canFetch = !!session.data && !!activeOrganizationId;

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
        const json = (await res.json()) as { count?: number };
        setCount(Number(json.count ?? 0));
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
