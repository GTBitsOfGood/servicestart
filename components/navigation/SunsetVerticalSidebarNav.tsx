"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BogIcon from "@/components/BogIcon/BogIcon";
import { SunsetLogo } from "@/components/navigation/SunsetLogo";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import { useNavbarVariant } from "@/components/NavbarVariantContext";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

type SidebarSubpage = {
  label: string;
  href: string;
};

type SidebarItem = {
  label: string;
  href: string;
  subpages?: SidebarSubpage[];
};

const MENU_ITEMS: SidebarItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Menu Item",
    href: "/menu-parent",
    subpages: [
      { label: "Subpage", href: "/subpage-1" },
      { label: "Subpage", href: "/subpage-2" },
    ],
  },
  { label: "Menu Item", href: "/menu-2" },
];

interface SunsetVerticalSidebarNavProps {
  organizationName?: string;
}

export function SunsetVerticalSidebarNav({
  organizationName = "bits of good",
}: SunsetVerticalSidebarNavProps) {
  const pathname = usePathname();
  const [openItemLabel, setOpenItemLabel] = useState<string | null>(null);
  const { navbarColor } = useNavbarVariant();
  const { organization } = useActiveOrganization();
  const session = authClient.useSession();

  const user = session.data?.user;
  const rawRole = (organization?.data as { role?: string } | undefined)?.role;
  const displayName =
    user?.name ?? (user?.email as string | undefined) ?? "User";
  const displayRole = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : "Member";

  const navBgClass = navbarColor === "white" ? "bg-[#FFFFFF]" : "bg-[#FEDED9]";

  return (
    <aside
      className={`flex h-screen w-[200px] flex-col justify-between py-8 shadow-[4px_0_12px_rgba(0,0,0,0.04)] ${navBgClass}`}
    >
      <div className="flex w-full flex-col">
        <div className="mb-10 px-6">
          <SunsetLogo size="md" />
        </div>

        <nav className="flex w-full flex-col text-[14px] font-normal text-[#22070B]">
          {MENU_ITEMS.map((item) => {
            const hasDropdown = !!item.subpages?.length;
            const isOpen = openItemLabel === item.label;

            const isSubActive = item.subpages?.some(
              (sub) => sub.href === pathname,
            );

            const isActiveTopLevel =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(item.href);

            const isActive = isActiveTopLevel || !!isSubActive;

            const iconName =
              item.label === "Home"
                ? "house"
                : item.label === "Events"
                  ? "calendar"
                  : item.label === "Notifications"
                    ? "bell"
                    : "chats";

            if (!hasDropdown) {
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex w-full items-center gap-3 px-6 py-5 transition-colors ${
                      isActive
                        ? "bg-[#FC5B43]/20 font-semibold"
                        : "hover:bg-[#FC5B43]/10"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <BogIcon name={iconName} size={20} color="#22070B" />
                      {item.label === "Notifications" && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FB3552] text-xs font-bold text-white">
                          4
                        </span>
                      )}
                    </span>
                    <span className="text-[14px]">{item.label}</span>
                  </div>
                </Link>
              );
            }

            return (
              <div key={item.href} className="flex flex-col">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between px-6 py-5 transition-colors ${
                    isActive
                      ? "bg-[#FC5B43]/20 font-semibold"
                      : "hover:bg-[#FC5B43]/10"
                  }`}
                  onClick={() =>
                    setOpenItemLabel((prev) =>
                      prev === item.label ? null : item.label,
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="relative shrink-0">
                      <BogIcon name={iconName} size={20} color="#22070B" />
                    </span>
                    <span className="text-[14px]">{item.label}</span>
                  </div>
                  <BogIcon
                    name={isOpen ? "chevron-down" : "chevron-right"}
                    size={16}
                    color="#22070B"
                  />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-2 bg-[#FEDED9] py-2 pl-14 pr-6">
                    {item.subpages?.map((sub) => {
                      const isSubpageActive = pathname === sub.href;
                      return (
                        <Link key={sub.href} href={sub.href}>
                          <div
                            className={`text-[14px] ${
                              isSubpageActive
                                ? "font-semibold text-[#22070B]"
                                : "text-[#B08A8A]"
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

      <div className="flex items-center gap-3 px-6">
        <ProfileAvatar />
        <div className="flex flex-col gap-0 text-paragraph-2">
          <span className="leading-none text-[14px] font-normal text-[#22070B]">
            {displayName}
          </span>
          <span className="leading-none text-[10px] font-normal text-[#22070B]">
            {displayRole}
          </span>
        </div>
      </div>
    </aside>
  );
}
