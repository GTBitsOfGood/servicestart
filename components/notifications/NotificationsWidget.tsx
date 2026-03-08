"use client";

import { useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";
import NotificationsSidebar from "./NotificationsSidebar";

export default function NotificationsWidget() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { count: unreadCount } = useUnreadNotificationCount();

  return (
    <>
      <button
        onClick={() => setSidebarOpen(true)}
        className="relative flex items-center gap-2 rounded border-2 border-grey-stroke-weak bg-grey-fill-weaker px-3 py-2 text-grey-text-strong hover:opacity-80"
        type="button"
      >
        <div className="relative inline-grid place-items-start">
          <BogIcon
            name="bell"
            size={36}
            color="var(--color-grey-text-strong)"
            className="col-start-1 row-start-1 mt-1"
          />
          {unreadCount > 0 && (
            <span className="col-start-1 row-start-1 ml-4 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-brand-text px-1 text-xs font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <span className="text-paragraph-1 font-semibold">Notifications</span>
      </button>

      <NotificationsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  );
}
