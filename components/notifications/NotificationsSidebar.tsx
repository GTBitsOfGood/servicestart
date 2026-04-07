"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { cn } from "@/lib/utils";
import NotificationItem from "./NotificationItem";
import { useNotifications } from "@/lib/hooks/useNotifications";

interface NotificationsSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function NotificationsSidebar({
  open,
  onClose,
}: NotificationsSidebarProps) {
  const [tab, setTab] = useState<"all" | "unread">("all");

  const {
    allNotifications,
    unreadNotifications,
    unreadCount,
    isLoading,
    isMarkAllReadPending,
    errorMessage,
    refreshNotifications,
    handleMarkAllRead,
    handleDelete,
    handleToggleRead,
  } = useNotifications();

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

        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-xl outline-none data-[state=open]:animate-fade-in">
          <div className="shrink-0 px-5 pt-6 sm:px-8 sm:pt-12">
            <div className="mb-4 sm:mb-8 flex items-center justify-between">
              <Dialog.Title className="text-heading-3 text-grey-text-strong">
                Notifications
              </Dialog.Title>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded p-1 text-grey-icon-weak hover:text-grey-text-strong"
                >
                  <BogIcon name="x" size={28} />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-4 py-1 text-paragraph-2",
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
                    "rounded-full px-4 py-1 text-paragraph-2",
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
                className="text-paragraph-2 font-semibold text-brand-text hover:opacity-80 disabled:opacity-50"
                onClick={() => void handleMarkAllRead()}
                disabled={isMarkAllReadPending || unreadCount === 0}
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto border-t border-grey-stroke-weak">
            {isLoading ? (
              <SidebarLoadingSkeleton />
            ) : errorMessage ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-5 sm:px-8 text-center">
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
                  className="mt-3 rounded bg-brand-text px-5 py-2 text-paragraph-2 font-semibold text-white hover:opacity-90"
                  onClick={() => void refreshNotifications()}
                >
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex h-full items-center justify-center px-5 sm:px-8 text-center">
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
          className="border-t border-grey-stroke-weak px-5 py-5 sm:px-14 sm:py-10 first:border-t-0"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="h-5 w-32 rounded bg-grey-fill-weak" />
            <div className="h-5 w-24 rounded bg-grey-fill-weak" />
          </div>
          <div className="mb-3 h-5 w-1/2 rounded bg-grey-fill-weak" />
          <div className="flex flex-col gap-1.5">
            <div className="h-5 w-full rounded bg-grey-fill-weak" />
            <div className="h-5 w-full rounded bg-grey-fill-weak" />
          </div>
        </div>
      ))}
    </div>
  );
}
