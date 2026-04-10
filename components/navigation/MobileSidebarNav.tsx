"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { UserProfileMenu } from "@/components/navigation/UserProfileMenu";
import { useUnreadNotificationCount } from "@/lib/hooks/useUnreadNotificationCount";
import { NavbarItem, NavbarProps } from "@/lib/navbar";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import type { MobileProfileOrientation } from "@/lib/services/OrganizationConfigService";

export type MobileDrawerSide = "left" | "right";

const navItemBase =
  "flex w-full items-center rounded-md px-4 py-3 text-paragraph-2 text-grey-text-strong transition-colors";
const navActiveClass = "bg-[#FDE2E2] font-semibold text-grey-text-strong";
const navInactiveHover = "hover:bg-grey-fill-weaker";

function HamburgerIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="2.5" rx="1.25" fill="currentColor" />
      <rect
        x="3"
        y="11"
        width="18"
        height="2.5"
        rx="1.25"
        fill="currentColor"
      />
      <rect
        x="3"
        y="17"
        width="18"
        height="2.5"
        rx="1.25"
        fill="currentColor"
      />
    </svg>
  );
}

function MobileTopBar({
  onMenuClick,
  menuSide,
}: {
  onMenuClick: () => void;
  menuSide: "left" | "right";
}) {
  const { count: unreadCount } = useUnreadNotificationCount();

  const hamburgerButton = (
    <button
      type="button"
      onClick={onMenuClick}
      aria-label="Open navigation menu"
      className="rounded-md p-2 text-grey-text-strong transition-colors hover:bg-brand-text/10"
    >
      <HamburgerIcon />
    </button>
  );

  const bellButton = (
    <Link
      href="/inbox"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      className="relative rounded-md p-2 text-grey-text-strong transition-colors hover:bg-brand-text/10"
    >
      <BogIcon name="bell" size={24} />
      {unreadCount > 0 && (
        <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-red-text px-1 text-xs font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between bg-white px-3 shadow-sm md:hidden">
      {menuSide === "left" ? hamburgerButton : bellButton}
      {menuSide === "left" ? bellButton : hamburgerButton}
    </header>
  );
}

function DrawerNavList({
  items,
  showIcons,
}: {
  items: NavbarItem[];
  showIcons: boolean;
}) {
  const pathname = usePathname();
  const [openItemLabel, setOpenItemLabel] = useState<string | null>(null);
  const { count: unreadCount } = useUnreadNotificationCount();

  return (
    <div className="flex flex-col px-2 py-3">
      {items.map((item) => {
        const hasDropdown = !!item.subpages?.length;
        const isOpen = openItemLabel === item.label;
        const showUnreadBadge =
          item.href === "/inbox" || item.href === "/notifications";

        const isSubActive = item.subpages?.some((sub) => sub.href === pathname);

        const isActiveTopLevel =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href);

        const isActive = isActiveTopLevel || !!isSubActive;

        const unreadBadge =
          showUnreadBadge && unreadCount > 0 ? (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-status-red-text px-0.5 text-xs font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null;

        if (!hasDropdown) {
          return (
            <Link key={item.href} href={item.href} className="block w-full">
              <div
                className={cn(
                  navItemBase,
                  "gap-3",
                  isActive ? navActiveClass : navInactiveHover,
                )}
              >
                {showIcons && (
                  <span className="relative shrink-0">
                    <BogIcon
                      name={item.icon}
                      size={18}
                      className="text-grey-text-strong"
                    />
                    {showUnreadBadge && unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-red-text px-0.5 text-xs font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span>{item.label}</span>
                  {!showIcons && unreadBadge}
                </span>
              </div>
            </Link>
          );
        }

        const subIndent = showIcons ? "pl-14" : "pl-6";

        return (
          <div key={item.href} className="flex flex-col">
            <button
              type="button"
              className={cn(
                navItemBase,
                "cursor-pointer justify-between gap-2",
                isActive ? navActiveClass : navInactiveHover,
              )}
              onClick={() =>
                setOpenItemLabel((prev) =>
                  prev === item.label ? null : item.label,
                )
              }
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {showIcons && (
                  <span className="relative shrink-0">
                    <BogIcon
                      name={item.icon}
                      size={18}
                      className="text-grey-text-strong"
                    />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span>{item.label}</span>
                  {!showIcons && unreadBadge}
                </span>
              </div>
              <BogIcon
                name={isOpen ? "chevron-down" : "chevron-right"}
                size={16}
                className="shrink-0 text-grey-text-strong"
              />
            </button>

            {isOpen && (
              <div className={cn("flex flex-col gap-2 py-2 pr-4", subIndent)}>
                {item.subpages?.map((sub) => {
                  const isSubpageActive = pathname === sub.href;
                  return (
                    <Link key={sub.href} href={sub.href}>
                      <div
                        className={
                          isSubpageActive
                            ? "font-semibold text-grey-text-strong"
                            : "text-paragraph-2 text-grey-text-weak"
                        }
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
    </div>
  );
}

function PinnedProfileHeader({
  displayName,
  displayRole,
  mounted,
  orientation,
}: {
  displayName: string;
  displayRole: string;
  mounted: boolean;
  orientation: MobileProfileOrientation;
}) {
  if (!mounted) {
    return (
      <div className="flex items-start gap-3">
        <ProfileAvatar size="lg" />
      </div>
    );
  }

  if (orientation === "vertical") {
    return (
      <div className="flex flex-col items-start gap-3">
        <ProfileAvatar size="lg" />
        <div className="flex min-w-0 flex-col items-start gap-0.5 text-left">
          <span className="truncate text-paragraph-1 font-semibold text-grey-text-strong">
            {displayName}
          </span>
          <span className="truncate text-paragraph-2 text-grey-text-weak">
            {displayRole}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <ProfileAvatar size="lg" />
      <div className="flex min-w-0 flex-col items-start text-left">
        <span className="truncate text-paragraph-1 font-semibold text-grey-text-strong">
          {displayName}
        </span>
        <span className="truncate text-paragraph-2 text-grey-text-weak">
          {displayRole}
        </span>
      </div>
    </div>
  );
}

export function MobileSidebarNav({
  items,
  drawerSide,
  pinnedUser = false,
  showIcons = drawerSide === "right",
  profileAvatarOrientation = "horizontal",
}: NavbarProps & {
  drawerSide: MobileDrawerSide;
  pinnedUser?: boolean;
  showIcons?: boolean;
  profileAvatarOrientation?: MobileProfileOrientation;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isRight = drawerSide === "right";

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const session = authClient.useSession();
  const { organization } = useActiveOrganization();
  const displayName =
    session.data?.user?.name ??
    (session.data?.user?.email as string | undefined) ??
    "";
  const rawRole = (organization?.data as { role?: string } | undefined)?.role;
  const displayRole = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : "";

  async function handleSignOut() {
    await authClient.signOut();
    setIsOpen(false);
    router.push("/login");
  }

  return (
    <div className="md:hidden">
      <MobileTopBar
        onMenuClick={() => setIsOpen(true)}
        menuSide={isRight ? "right" : "left"}
      />

      <div
        onClick={() => setIsOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <nav
        aria-label="Mobile navigation"
        className={cn(
          "fixed top-0 z-50 flex h-full w-[min(18rem,100vw)] flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out",
          isRight ? "right-0" : "left-0",
          isOpen
            ? "translate-x-0"
            : isRight
              ? "translate-x-full"
              : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center px-5 pt-5 pb-3",
            isRight && "justify-end",
          )}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-md p-1 transition-colors hover:bg-grey-fill-weaker"
          >
            <BogIcon name="x" size={20} className="text-grey-text-strong" />
          </button>
        </div>

        {pinnedUser ? (
          <div className="shrink-0 border-b border-grey-stroke-weak px-5 pb-4">
            <PinnedProfileHeader
              displayName={displayName}
              displayRole={displayRole}
              mounted={mounted}
              orientation={profileAvatarOrientation}
            />

            {mounted ? (
              <div className="mt-4 flex flex-col gap-1">
                <Link
                  href="/profile"
                  className="rounded-md px-2 py-2 text-paragraph-2 text-grey-text-strong hover:bg-grey-fill-weaker"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="rounded-md px-2 py-2 text-paragraph-2 text-grey-text-strong hover:bg-grey-fill-weaker"
                >
                  Settings
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <DrawerNavList items={items} showIcons={showIcons} />
        </div>

        {pinnedUser ? (
          <div className="shrink-0 border-t border-grey-stroke-weak px-5 py-3">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="w-full rounded-md px-2 py-2 text-left text-paragraph-2 font-semibold text-status-red-text hover:bg-grey-fill-weaker"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="shrink-0 border-t border-grey-stroke-weak px-2 py-3">
            <UserProfileMenu
              direction="vertical"
              verticalFlyout={isRight ? "start" : "end"}
              hostOpen={isOpen}
              showChevron
              avatarLayout={profileAvatarOrientation}
            />
          </div>
        )}
      </nav>
    </div>
  );
}
