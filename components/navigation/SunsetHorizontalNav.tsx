"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SunsetLogo } from "@/components/navigation/SunsetLogo";
import BogIcon from "@/components/BogIcon/BogIcon";
import { UserProfileMenu } from "@/components/navigation/UserProfileMenu";
import { useNavbarVariant } from "@/components/NavbarVariantContext";

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

interface SunsetHorizontalNavProps {
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
    <nav className="flex h-full items-stretch gap-8 text-[14px] font-normal text-[#22070B]">
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
                  className={`text-[14px] font-normal ${
                    isActive ? "font-semibold" : ""
                  }`}
                >
                  {item.label}
                </span>
                <div
                  className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
                    isActive ? "bg-[#FC5B43]" : "bg-transparent"
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
                className={`text-[14px] font-normal ${
                  isActive ? "font-semibold" : ""
                }`}
              >
                {item.label}
              </span>
              <BogIcon
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color="#22070B"
              />
              <div
                className={`absolute bottom-0 left-0 right-0 h-1 transition-colors ${
                  isActive ? "bg-[#FC5B43]" : "bg-transparent"
                }`}
              />
            </button>

            {isOpen && (
              <div className="absolute left-0 top-full mt-3 w-56 rounded-xl bg-[#FFE9C4] p-2 text-[14px] shadow-[0_6px_18px_rgba(0,0,0,0.12)]">
                {item.subpages?.map((sub, index) => {
                  const isSubActive = pathname === sub;
                  return (
                    <Link key={sub} href={sub}>
                      <div
                        className={`rounded-lg px-4 py-2 text-[14px] transition-colors ${
                          isSubActive
                            ? "bg-[#FC5B43]/20 font-semibold"
                            : "hover:bg-[#FC5B43]/10"
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
  return (
    <div className="flex items-center gap-6">
      <button className="relative">
        <span className="relative inline-flex">
          <BogIcon name="bell" size={22} color="#22070B" />
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FB3552] text-xs font-bold text-white">
            4
          </span>
        </span>
      </button>

      <UserProfileMenu />
    </div>
  );
}

export function SunsetHorizontalNav({ alignment }: SunsetHorizontalNavProps) {
  const pathname = usePathname();

  const { navbarColor } = useNavbarVariant();
  const navBgClass = navbarColor === "white" ? "bg-[#FFFFFF]" : "bg-[#FEDED9]";

  if (alignment === "left") {
    return (
      <header
        className={`relative flex h-20 items-center px-10 shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${navBgClass}`}
      >
        <NavTabs items={NAV_ITEMS} pathname={pathname} />
        <div className="flex flex-1 justify-center">
          <SunsetLogo size="sm" />
        </div>
        <RightSide />
      </header>
    );
  }

  if (alignment === "right") {
    return (
      <header
        className={`relative flex h-20 items-center px-10 shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${navBgClass}`}
      >
        <SunsetLogo size="sm" />
        <div className="flex flex-1" />
        <NavTabs items={NAV_ITEMS} pathname={pathname} />
        <RightSide />
      </header>
    );
  }

  // center
  return (
    <header
      className={`relative flex h-20 items-center px-10 shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${navBgClass}`}
    >
      <SunsetLogo size="sm" />
      <div className="flex h-full flex-1 items-stretch justify-center">
        <NavTabs items={NAV_ITEMS} pathname={pathname} />
      </div>
      <RightSide />
    </header>
  );
}
