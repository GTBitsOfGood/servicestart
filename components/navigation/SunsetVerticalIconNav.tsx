"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";

const MENU_ITEMS = [
  { label: "Home", href: "/", icon: "house" as const },
  { label: "Events", href: "/events", icon: "calendar" as const },
  { label: "Messages", href: "/messages", icon: "chats" as const },
  { label: "Notifications", href: "/notifications", icon: "bell" as const },
];

export function SunsetVerticalIconNav() {
  const pathname = usePathname();
  const { organization } = useActiveOrganization();
  const session = authClient.useSession();
  const { count: unreadCount } = useUnreadNotificationCount();

  const user = session.data?.user;
  const rawRole = (organization?.data as { role?: string } | undefined)?.role;
  const displayName =
    user?.name ?? (user?.email as string | undefined) ?? "User";
  const displayRole = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : "Member";

  const navBgClass = "bg-brand-fill";

  return (
    <aside
      className={`flex h-screen w-24 flex-col items-center justify-between py-8 ${navBgClass}`}
    >
      <nav className="flex w-full flex-col gap-0.5 text-[14px] font-normal text-grey-text-strong">
        {MENU_ITEMS.map((item) => {
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
