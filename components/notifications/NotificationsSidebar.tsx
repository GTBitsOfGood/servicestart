"use client";

import { useState, useCallback, useEffect } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import api from "@/lib/api";
import NotificationItem, {
  type NotificationListItem,
} from "./NotificationItem";

type NotificationsResponse = {
  data?: NotificationListItem[];
};

type UnreadCountResponse = {
  count?: number;
};

interface NotificationsSidebarProps {
  open: boolean;
  onClose: () => void;
}

async function fetchNotifications(
  read: "" | "false",
  signal?: AbortSignal,
): Promise<NotificationListItem[]> {
  const response = await api.notifications.$get(
    {
      query: { read, pageSize: "50" },
    },
    signal ? { init: { signal } } : undefined,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  const json = (await response.json()) as NotificationsResponse;
  return json.data ?? [];
}

async function fetchUnreadCount(signal?: AbortSignal): Promise<number> {
  const response = await api.notifications.unreadCount.$get(
    {},
    signal ? { init: { signal } } : undefined,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }

  const json = (await response.json()) as UnreadCountResponse;
  return Number(json.count ?? 0);
}

export default function NotificationsSidebar({
  open,
  onClose,
}: NotificationsSidebarProps) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [allNotifications, setAllNotifications] = useState<
    NotificationListItem[]
  >([]);
  const [unreadNotifications, setUnreadNotifications] = useState<
    NotificationListItem[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkAllReadPending, setIsMarkAllReadPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const loadNotifications = useCallback(async (signal?: AbortSignal) => {
    const [all, unread, count] = await Promise.all([
      fetchNotifications("", signal),
      fetchNotifications("false", signal),
      fetchUnreadCount(signal),
    ]);

    setAllNotifications(all);
    setUnreadNotifications(unread);
    setUnreadCount(count);
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      await loadNotifications();
      setErrorMessage(null);
    } catch {
      setErrorMessage("Unable to refresh notifications.");
    }
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage(null);

    loadNotifications(controller.signal)
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setAllNotifications([]);
        setUnreadNotifications([]);
        setUnreadCount(0);
        setErrorMessage("Unable to load notifications.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [open, loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    setIsMarkAllReadPending(true);
    setErrorMessage(null);

    try {
      const response = await api.notifications["mark-all-read"].$post({});
      if (!response.ok) {
        throw new Error("Could not mark all as read");
      }
      await refreshNotifications();
    } catch {
      setErrorMessage("Could not mark all notifications as read.");
    } finally {
      setIsMarkAllReadPending(false);
    }
  }, [refreshNotifications]);

  const notifications = tab === "all" ? allNotifications : unreadNotifications;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-[var(--color-sidebar-overlay)] ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 z-50 h-full w-[var(--color-sidebar-width)] bg-white shadow-xl flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-[31px] pt-[49px] pb-0 shrink-0">
          <div className="flex items-center justify-between mb-[32px]">
            <h2 className="text-heading-3 text-grey-text-strong">
              Notifications
            </h2>
            <button
              onClick={onClose}
              className="text-grey-icon-weak hover:text-grey-text-strong p-1"
            >
              <BogIcon name="x" size={28} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[12px]">
              <button
                className={`h-[30px] px-[16px] rounded-full text-[14px] font-medium ${
                  tab === "all"
                    ? "bg-brand-text text-white"
                    : "border border-grey-stroke-weak text-grey-text-weak hover:text-grey-text-strong"
                }`}
                onClick={() => setTab("all")}
              >
                All
              </button>
              <button
                className={`h-[30px] px-[16px] rounded-full text-[14px] font-medium ${
                  tab === "unread"
                    ? "bg-brand-text text-white"
                    : "border border-grey-stroke-weak text-grey-text-weak hover:text-grey-text-strong"
                }`}
                onClick={() => setTab("unread")}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <button
              className="text-[14px] font-medium text-brand-text hover:opacity-80 disabled:opacity-50"
              onClick={() => void handleMarkAllRead()}
              disabled={isMarkAllReadPending || unreadCount === 0}
            >
              Mark all read
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-[16px] border-t border-grey-stroke-weak">
          {isLoading ? (
            <SidebarLoadingSkeleton />
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
              <p className="text-paragraph-2 text-grey-text-weak">
                {errorMessage}
              </p>
              <button
                className="text-[14px] font-semibold text-brand-text"
                onClick={() => void refreshNotifications()}
              >
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-heading-3 text-grey-text-weak">
                No notifications yet.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                compact
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function SidebarLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="px-[36px] py-[36px] border-t border-grey-stroke-weak first:border-t-0"
        >
          <div className="flex items-center justify-between mb-[12px]">
            <div className="w-[128px] h-[20px] bg-grey-fill-weak rounded" />
            <div className="w-[92px] h-[20px] bg-grey-fill-weak rounded" />
          </div>
          <div className="w-[197px] h-[22px] bg-grey-fill-weak rounded mb-[12px]" />
          <div className="space-y-[6px]">
            <div className="w-full h-[20px] bg-grey-fill-weak rounded" />
            <div className="w-full h-[20px] bg-grey-fill-weak rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
