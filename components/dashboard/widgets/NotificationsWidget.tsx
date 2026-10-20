"use client";

import Link from "next/link";
import { useEffect } from "react";
import NotificationItem from "@/components/notifications/NotificationItem";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";

const MAX_VISIBLE = 5;

export default function NotificationsDashboardWidget() {
  const {
    unreadNotifications,
    unreadCount,
    isLoading,
    errorMessage,
    refreshNotifications,
    handleToggleRead,
  } = useNotifications();
  const { count: sharedUnreadCount } = useUnreadNotificationCount();

  // The bell sidebar and inbox publish the unread count when they change it;
  // reload so this card doesn't keep showing notifications read elsewhere.
  useEffect(() => {
    if (!isLoading && sharedUnreadCount !== unreadCount) {
      void refreshNotifications();
    }
  }, [isLoading, sharedUnreadCount, unreadCount, refreshNotifications]);

  const visible = unreadNotifications.slice(0, MAX_VISIBLE);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-solid-bg-base p-8">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-heading-3 font-semibold text-app-strong-text">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-grey-fill-weak px-1.5 text-small font-medium text-grey-text-weak">
              {unreadCount}
            </span>
          )}
        </div>
        <Link
          href="/inbox"
          className="text-paragraph-2 font-semibold text-brand-text hover:opacity-80"
        >
          View all
        </Link>
      </div>

      <div className="-mx-8 mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading notifications"
            className="flex animate-pulse flex-col gap-4 px-8"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-grey-fill-weak" />
            ))}
          </div>
        ) : errorMessage ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-paragraph-1 text-grey-text-weak">
              {errorMessage}
            </p>
            <button
              type="button"
              className="theme-control rounded bg-brand-text px-4 py-2 text-paragraph-2 font-semibold text-brand-foreground hover:opacity-90"
              onClick={() => void refreshNotifications()}
            >
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-paragraph-1 text-grey-text-weak">
            No new notifications
          </div>
        ) : (
          visible.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onToggleRead={handleToggleRead}
              compact
            />
          ))
        )}
      </div>
    </div>
  );
}
