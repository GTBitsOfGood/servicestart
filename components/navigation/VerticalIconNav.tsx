"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";
import { NavbarProps } from "@/lib/navbar";

export function VerticalIconNav({ items }: NavbarProps) {
  const pathname = usePathname();
  const { count: unreadCount } = useUnreadNotificationCount();

  const navBgClass = "bg-brand-fill";

  return (
    <aside
      className={`flex h-screen w-24 flex-col items-center justify-between py-8 shadow-md ${navBgClass}`}
    >
      <nav className="flex w-full flex-col gap-0.5 text-nav font-normal text-grey-text-strong">
        {items.map((item) => {
          const href = item.href;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const isNotifications = item.label === "Notifications";

          return (
            <Link key={href} href={href} className="block w-full">
              <div
                className={`flex h-20 w-full items-center justify-center transition-colors ${
                  isActive
                    ? "bg-brand-text/20 font-semibold"
                    : "hover:bg-brand-text/10"
                }`}
              >
                <span className="relative shrink-0">
                  <BogIcon
                    name={item.icon}
                    size={22}
                    className="text-grey-text-strong"
                  />
                  {isNotifications && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-red-text px-1 text-xs font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <ProfileAvatar />
    </aside>
  );
}
