"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SunsetLogo } from "@/components/navigation/Logo";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { UserProfileMenu } from "@/components/navigation/UserProfileMenu";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";

type HorizontalAlignment = "left" | "center" | "right";

type HorizontalNavItem = {
  label: string;
  href: string;
  subpages?: string[];
};

const NAV_ITEMS: HorizontalNavItem[] = [
  { label: "Menu Item", href: "/" },
  {
    label: "Menu Item",
    href: "/menu-parent",
    subpages: ["/subpage-1", "/subpage-2", "/subpage-3", "/subpage-4"],
  },
  { label: "Menu Item", href: "/menu-2" },
];

interface HorizontalNavProps {
  alignment: HorizontalAlignment;
}

function NavTabs({
  items,
  pathname,
}: {
  items: HorizontalNavItem[];
  pathname: string;
}) {
  const [openDropdownLabel, setOpenDropdownLabel] = useState<string | null>(
    null,
  );

  return (
    <nav className="flex h-full items-stretch gap-8 text-nav font-normal text-grey-text-strong">
      {items.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href);

        const hasDropdown = !!item.subpages?.length;

        if (!hasDropdown) {
          return (
            <Link key={item.href} href={item.href}>
              <button className="relative flex h-full items-center gap-1 px-4">
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
              </button>
            </Link>
          );
        }

        const isOpen = openDropdownLabel === item.label;

        return (
          <div key={item.href} className="relative">
            <button
              type="button"
              className="relative flex h-full items-center gap-1 px-4"
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
              <div className="absolute left-0 top-full mt-3 w-56 rounded-xl bg-solid-bg-base p-2 text-small shadow-[0_6px_18px_rgba(0,0,0,0.12)]">
                {item.subpages?.map((sub, index) => {
                  const isSubActive = pathname === sub;
                  return (
                    <Link key={sub} href={sub}>
                      <div
                        className={`rounded-lg px-4 py-2 text-small transition-colors ${
                          isSubActive
                            ? "bg-brand-text/20 font-semibold"
                            : "hover:bg-brand-text/10"
                        } ${index === 0 ? "mb-1" : ""}`}
                      >
                        Subpage
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
    <div className="flex items-center gap-6">
      <button className="relative">
        <span className="relative inline-flex">
          <BogIcon name="bell" size={22} className="text-grey-text-strong" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-red-text px-1 text-xs font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
      </button>

      <UserProfileMenu />
    </div>
  );
}

export function HorizontalNav({ alignment }: HorizontalNavProps) {
  const pathname = usePathname();

  const navBgClass = "bg-brand-fill";

  const tabs = <NavTabs items={NAV_ITEMS} pathname={pathname} />;
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
      <div className="flex h-full flex-1 items-stretch justify-center">
        {tabs}
      </div>
    );
    rightContent = right;
  }

  return (
    <header
      className={`relative flex h-20 items-center px-10 shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${navBgClass}`}
    >
      {leftContent}
      {middleContent}
      {rightContent}
    </header>
  );
}
