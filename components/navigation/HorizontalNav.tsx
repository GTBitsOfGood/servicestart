"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SunsetLogo } from "@/components/navigation/Logo";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { UserProfileMenu } from "@/components/navigation/UserProfileMenu";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";
import { NavbarItem, NavbarProps } from "@/lib/navbar";
import NotificationCounter from "./NotificationCounter";

type HorizontalAlignment = "left" | "center" | "right";

interface HorizontalNavProps {
  alignment: HorizontalAlignment;
}

function NavTabs({
  items,
  pathname,
}: {
  items: NavbarItem[];
  pathname: string;
}) {
  const [openDropdownLabel, setOpenDropdownLabel] = useState<string | null>(
    null,
  );

  return (
    <nav className="flex h-full max-w-full items-stretch gap-2 overflow-x-auto text-nav font-normal text-grey-text-strong mobile:gap-8">
      {items.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href);

        const hasDropdown = !!item.subpages?.length;

        if (!hasDropdown) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex h-full shrink-0 items-center gap-1 px-2 mobile:px-4"
            >
              <span
                className={`font-normal ${isActive ? "font-semibold" : ""}`}
              >
                {item.label}
              </span>
              <div
                className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
                  isActive ? "bg-brand-text" : "bg-transparent"
                }`}
              />
            </Link>
          );
        }

        const isOpen = openDropdownLabel === item.label;

        return (
          <div key={item.href} className="relative">
            <button
              className="relative flex h-full shrink-0 cursor-pointer items-center gap-1 px-2 mobile:px-4"
              onClick={() =>
                setOpenDropdownLabel((prev) =>
                  prev === item.label ? null : item.label,
                )
              }
            >
              <span
                className={`font-normal ${isActive ? "font-semibold" : ""}`}
              >
                {item.label}
              </span>
              <BogIcon
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={14}
                className="text-grey-text-strong"
              />
              <div
                className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
                  isActive ? "bg-brand-text" : "bg-transparent"
                }`}
              />
            </button>

            {isOpen && (
              <div className="absolute left-0 top-full mt-3 w-56 rounded-xl bg-solid-bg-base p-2 text-small shadow-lg">
                {item.subpages?.map((sub, index) => {
                  const isSubActive = pathname === sub.href;
                  return (
                    <Link key={sub.href} href={sub.href}>
                      <div
                        className={`rounded-lg px-4 py-2 text-small transition-colors ${
                          isSubActive
                            ? "bg-brand-text/20 font-semibold"
                            : "hover:bg-brand-text/10"
                        } ${index === 0 ? "mb-1" : ""}`}
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
  );
}

function RightSide() {
  const { count: unreadCount } = useUnreadNotificationCount();

  return (
    <div className="flex shrink-0 items-center gap-2 mobile:gap-6">
      <NotificationCounter unreadCount={unreadCount} />
      <UserProfileMenu direction="horizontal" />
    </div>
  );
}

export function HorizontalNav({
  alignment,
  items,
}: HorizontalNavProps & NavbarProps) {
  const pathname = usePathname();

  const navBgClass = "bg-brand-fill";

  const tabs = <NavTabs items={items} pathname={pathname} />;
  const logo = <SunsetLogo size="sm" />;
  const right = <RightSide />;

  let leftContent: React.ReactNode;
  let middleContent: React.ReactNode;
  let rightContent: React.ReactNode;

  if (alignment === "left") {
    leftContent = tabs;
    middleContent = <div className="flex flex-1 justify-center">{logo}</div>;
    rightContent = right;
  } else if (alignment === "right") {
    leftContent = (
      <>
        {logo}
        <div className="flex flex-1" />
      </>
    );
    middleContent = tabs;
    rightContent = right;
  } else {
    // center
    leftContent = logo;
    middleContent = (
      <div className="flex h-full min-w-0 flex-1 items-stretch justify-center">
        {tabs}
      </div>
    );
    rightContent = right;
  }

  return (
    <header
      className={`relative flex h-16 items-center overflow-x-hidden px-3 shadow-sm mobile:h-20 mobile:px-6 desktop:px-10 ${navBgClass}`}
    >
      {leftContent}
      {middleContent}
      {rightContent}
    </header>
  );
}
