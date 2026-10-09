import BogIcon from "../bog/BogIcon/BogIcon";
import NotificationsSidebar from "@/components/notifications/NotificationsSidebar";
import { cn } from "@/lib/utils";

export default function NotificationCounter({
  unreadCount,
  iconSize = 22,
  className,
  badgeClassName,
}: {
  unreadCount: number;
  iconSize?: number;
  className?: string;
  badgeClassName?: string;
}) {
  return (
    <NotificationsSidebar
      trigger={
        <button
          type="button"
          aria-label="Notifications"
          className={cn("relative cursor-pointer", className)}
        >
          <span className="relative inline-flex">
            <BogIcon name="bell" size={iconSize} className="text-page-text" />
            {unreadCount > 0 && (
              <span
                className={cn(
                  "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-red-text px-1 text-xs font-bold text-white",
                  badgeClassName,
                )}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
        </button>
      }
    />
  );
}
