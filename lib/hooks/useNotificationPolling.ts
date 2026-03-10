"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import authClient from "@/lib/authClient";
import type { NotificationListItem } from "@/components/notifications/NotificationItem";

const POLL_INTERVAL_MS = 60_000;
const MAX_VISIBLE_TOASTS = 3;

export function useNotificationPolling() {
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();
  const canPoll = !!session.data && !!organization.data?.id;

  const seenIds = useRef<Set<string>>(new Set());
  const isFirstPoll = useRef(true);
  const [toasts, setToasts] = useState<NotificationListItem[]>([]);

  const poll = useCallback(async () => {
    try {
      const res = await api.notifications.$get({
        query: { read: "unread", pageSize: "10" },
      });

      if (!res.ok) return;

      const { data: notifications } = await res.json();

      if (isFirstPoll.current) {
        for (const n of notifications) {
          seenIds.current.add(n.id);
        }
        isFirstPoll.current = false;
        return;
      }

      const fresh: NotificationListItem[] = [];
      for (const n of notifications) {
        if (!seenIds.current.has(n.id)) {
          seenIds.current.add(n.id);
          fresh.push(n);
        }
      }

      if (fresh.length > 0) {
        setToasts((prev) => [...fresh, ...prev].slice(0, MAX_VISIBLE_TOASTS));
      }
    } catch {
      /* network errors are silently ignored -- next poll will retry */
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!canPoll) return;

    isFirstPoll.current = true;
    seenIds.current.clear();

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void poll();
    const handle = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      clearInterval(handle);
    };
  }, [canPoll, poll]);

  return { toasts, dismissToast };
}
