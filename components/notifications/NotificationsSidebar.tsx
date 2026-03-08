"use client";

import { useState, useCallback, useEffect } from "react";
import { Dialog } from "radix-ui";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import NotificationItem, {
  type NotificationListItem,
} from "./NotificationItem";

type ReadFilter = "all" | "read" | "unread";

interface NotificationsSidebarProps {
  open: boolean;
  onClose: () => void;
}

async function fetchNotifications(read: ReadFilter) {
  const response = await api.notifications.$get({
    query: { read, pageSize: "50" },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  const json = await response.json();
  return json.data ?? [];
}

async function fetchUnreadCount() {
  const response = await api.notifications.unreadCount.$get({});

  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }

  const json = await response.json();
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

  const loadNotifications = useCallback(async () => {
    const all = await fetchNotifications("all");
    const unread = await fetchNotifications("unread");
    const count = await fetchUnreadCount();

    setAllNotifications(all);
    setUnreadNotifications(unread);
    setUnreadCount(count);
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      await loadNotifications();
      setErrorMessage(null);
    } catch {
      setErrorMessage("Failed to load");
    }
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    loadNotifications()
      .catch(() => {
        setAllNotifications([]);
        setUnreadNotifications([]);
        setUnreadCount(0);
        setErrorMessage("Failed to load");
      })
      .finally(() => {
        setIsLoading(false);
      });
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
      setErrorMessage("Failed to load");
    } finally {
      setIsMarkAllReadPending(false);
    }
  }, [refreshNotifications]);

  const runMutation = useCallback(
    async (mutation: () => Promise<Response>) => {
      try {
        const response = await mutation();
        if (!response.ok) {
          throw new Error("Mutation failed");
        }
        await refreshNotifications();
      } catch {
        /* silently fail for individual item actions */
      }
    },
    [refreshNotifications],
  );

  const handleDelete = useCallback(
    (id: string) => {
      void runMutation(() =>
        api.notifications[":id"].$delete({ param: { id } }),
      );
    },
    [runMutation],
  );

  const handleToggleRead = useCallback(
    (id: string, read: boolean) => {
      void runMutation(() =>
        api.notifications[":id"].$patch({ param: { id }, json: { read } }),
      );
    },
    [runMutation],
  );

  const notifications = tab === "all" ? allNotifications : unreadNotifications;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />

        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[425px] flex-col bg-white shadow-[0px_8px_8px_-4px_rgba(0,0,0,0.04),0px_20px_24px_-4px_rgba(0,0,0,0.08)] outline-none data-[state=open]:animate-fade-in">
          {/* Header */}
          <div className="shrink-0 px-[31px] pt-[49px]">
            <div className="mb-[32px] flex items-center justify-between">
              <Dialog.Title className="text-[24px] font-bold leading-normal text-grey-text-strong">
                Notifications
              </Dialog.Title>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-[4px] p-[2px] text-grey-icon-weak hover:text-grey-text-strong"
                >
                  <BogIcon name="x" size={28} />
                </button>
              </Dialog.Close>
            </div>

            {/* Pill tabs + Mark all read */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[12px]">
                <button
                  type="button"
                  className={cn(
                    "rounded-[48px] px-[16px] py-[4px] text-[16px]",
                    tab === "all"
                      ? "bg-brand-text font-bold text-white"
                      : "border border-grey-stroke-strong text-grey-text-weak",
                  )}
                  onClick={() => setTab("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-[48px] px-[16px] py-[4px] text-[16px]",
                    tab === "unread"
                      ? "bg-brand-text font-bold text-white"
                      : "border border-grey-stroke-strong text-grey-text-weak",
                  )}
                  onClick={() => setTab("unread")}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              <button
                type="button"
                className="text-[16px] font-semibold text-brand-text hover:opacity-80 disabled:opacity-50"
                onClick={() => void handleMarkAllRead()}
                disabled={isMarkAllReadPending || unreadCount === 0}
              >
                Mark all read
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="mt-[16px] flex-1 overflow-y-auto border-t border-grey-stroke-weak">
            {isLoading ? (
              <SidebarLoadingSkeleton />
            ) : errorMessage ? (
              <div className="flex h-full flex-col items-center justify-center gap-0 px-[32px] text-center">
                <BogIcon
                  name="error"
                  size={84}
                  color="var(--color-grey-icon-weak)"
                />
                <p className="text-heading-3 text-grey-text-weak">
                  Failed to load
                </p>
                <button
                  type="button"
                  className="mt-[12px] h-[40px] rounded-[4px] bg-brand-text px-[20px] text-[14px] font-semibold text-white hover:opacity-90"
                  onClick={() => void refreshNotifications()}
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex h-full items-center justify-center px-[32px] text-center">
                <p className="text-heading-3 text-grey-text-weak">
                  No notifications yet.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onDelete={handleDelete}
                  onToggleRead={handleToggleRead}
                  compact
                />
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SidebarLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border-t border-grey-stroke-weak px-[36px] py-[24px] first:border-t-0"
        >
          <div className="mb-[12px] flex items-center justify-between">
            <div className="h-[20px] w-[128px] rounded-[4px] bg-grey-fill-weak" />
            <div className="h-[20px] w-[92px] rounded-[4px] bg-grey-fill-weak" />
          </div>
          <div className="mb-[12px] h-[22px] w-[197px] rounded-[4px] bg-grey-fill-weak" />
          <div className="flex flex-col gap-[6px]">
            <div className="h-[20px] w-full rounded-[4px] bg-grey-fill-weak" />
            <div className="h-[20px] w-full rounded-[4px] bg-grey-fill-weak" />
          </div>
        </div>
      ))}
    </div>
  );
}
