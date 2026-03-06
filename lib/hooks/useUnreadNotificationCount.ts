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

  useEffect(() => {
    if (!session.data || !activeOrganizationId) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

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
  }, [activeOrganizationId, session.data]);

  return { count, isLoading };
}
