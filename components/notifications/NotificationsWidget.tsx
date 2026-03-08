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
        className="relative flex items-center gap-[4px] h-[42px] hover:opacity-80"
      >
        <div className="relative w-[40px] h-[40px] flex items-center justify-center">
          <BogIcon
            name="bell"
            size={36}
            color="var(--color-grey-text-strong)"
          />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-[-4px] min-w-[24px] h-[24px] flex items-center justify-center rounded-full bg-brand-text text-white text-[12px] font-semibold leading-[15px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      </button>

      <NotificationsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  );
}
