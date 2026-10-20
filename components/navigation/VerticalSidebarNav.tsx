"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { SunsetLogo } from "@/components/navigation/Logo";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";
import { NavbarProps } from "@/lib/navbar";
import { UserProfileMenu } from "./UserProfileMenu";
import NotificationsSidebar from "@/components/notifications/NotificationsSidebar";

export function VerticalSidebarNav({ items }: NavbarProps) {
  const pathname = usePathname();
  const [openItemLabel, setOpenItemLabel] = useState<string | null>(null);
  const { count: unreadCount } = useUnreadNotificationCount();

  const navBgClass = "bg-navbar-bg";

  return (
    <aside
      className={`sticky top-0 flex h-screen w-[200px] shrink-0 flex-col justify-between py-8 shadow-md ${navBgClass}`}
    >
      <div className="flex w-full flex-col">
        <div className="mb-10 px-6">
          <SunsetLogo size="md" />
        </div>

        <nav className="flex w-full flex-col text-nav font-normal text-page-text">
          {items.map((item) => {
            const hasDropdown = !!item.subpages?.length;
            const isOpen = openItemLabel === item.label;
            const isNotifications =
              item.href === "/inbox" || item.href === "/notifications";

            const isSubActive = item.subpages?.some(
              (sub) => sub.href === pathname,
            );

            const isActiveTopLevel =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href);

            const isActive = isActiveTopLevel || !!isSubActive;

            if (!hasDropdown) {
              const navItem = (
                <div
                  className={`flex w-full items-center gap-3 px-6 py-5 transition-colors ${
                    isActive
                      ? "bg-brand-text/20 font-semibold"
                      : "hover:bg-brand-text/10"
                  }`}
                >
                  <span className="relative shrink-0">
                    <BogIcon
                      name={item.icon}
                      size={20}
                      className="text-page-text"
                    />
                    {isNotifications && unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-red-text px-1 text-xs font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span>{item.label}</span>
                </div>
              );

              if (isNotifications) {
                return (
                  <NotificationsSidebar
                    key={item.href}
                    trigger={
                      <button
                        type="button"
                        aria-label="Notifications"
                        className="w-full text-left"
                      >
                        {navItem}
                      </button>
                    }
                  />
                );
              }

              return (
                <Link key={item.href} href={item.href}>
                  {navItem}
                </Link>
              );
            }

            return (
              <div key={item.href} className="flex flex-col">
                <button
                  type="button"
                  className={`flex w-full cursor-pointer items-center justify-between px-6 py-5 transition-colors ${
                    isActive
                      ? "bg-brand-text/20 font-semibold"
                      : "hover:bg-brand-text/10"
                  }`}
                  onClick={() =>
                    setOpenItemLabel((prev) =>
                      prev === item.label ? null : item.label,
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="relative shrink-0">
                      <BogIcon
                        name={item.icon}
                        size={20}
                        className="text-page-text"
                      />
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <BogIcon
                    name={isOpen ? "chevron-down" : "chevron-right"}
                    size={16}
                    className="text-page-text"
                  />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-2 bg-navbar-bg py-2 pl-14 pr-6">
                    {item.subpages?.map((sub) => {
                      const isSubpageActive = pathname === sub.href;
                      return (
                        <Link key={sub.href} href={sub.href}>
                          <div
                            className={`${
                              isSubpageActive
                                ? "font-semibold text-page-text"
                                : "text-page-text/70"
                            }`}
                          >
                            {sub.label}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <UserProfileMenu direction="vertical" />
    </aside>
  );
}
