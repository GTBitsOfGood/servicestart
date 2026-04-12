import { ReactNode } from "react";
import { VerticalSidebarNav } from "@/components/navigation/VerticalSidebarNav";
import { VerticalIconNav } from "@/components/navigation/VerticalIconNav";
import { HorizontalNav } from "@/components/navigation/HorizontalNav";
import {
  MobileSidebarNav,
  type MobileDrawerSide,
} from "@/components/navigation/MobileSidebarNav";
import { OrganizationConfigKey } from "@/lib/schema";
import OrganizationConfigService, {
  ALLOWED_NAVBAR_VARIANTS,
  ALLOWED_MOBILE_NAVBAR_VARIANTS,
  resolveMobileShowIcons,
} from "@/lib/services/OrganizationConfigService";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import getNavbarItems from "@/lib/getNavbarItems";
import { getActiveOrganizationIdFromHeaders } from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";

interface NavbarProps {
  children: ReactNode;
}

export default async function Navbar({ children }: NavbarProps) {
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });
  const orgId = await getActiveOrganizationIdFromHeaders(headerList);

  const [variantConfig, mobileConfig] = await Promise.all([
    orgId
      ? OrganizationConfigService.getConfig(orgId, [
          OrganizationConfigKey.NavbarVariant,
        ])
      : null,
    orgId
      ? OrganizationConfigService.getConfig(orgId, [
          OrganizationConfigKey.MobileNavbarVariant,
          OrganizationConfigKey.MobileNavbarShowIcons,
        ])
      : null,
  ]);

  const variant: (typeof ALLOWED_NAVBAR_VARIANTS)[number] =
    variantConfig?.[OrganizationConfigKey.NavbarVariant] ?? "vertical-sidebar";

  const mobileVariant: (typeof ALLOWED_MOBILE_NAVBAR_VARIANTS)[number] =
    mobileConfig?.[OrganizationConfigKey.MobileNavbarVariant] ??
    "mobile-left-sidebar";

  const navbarItems = await getNavbarItems(session, orgId);

  const mobileDrawerSide: MobileDrawerSide = mobileVariant.includes("right")
    ? "right"
    : "left";
  const mobilePinnedUser = mobileVariant.includes("pinned");
  const mobileShowIconsFromVariant =
    mobileVariant.includes("icons") ||
    (mobileDrawerSide === "right" && !mobileVariant.includes("no-icons"));
  const mobileShowIcons = resolveMobileShowIcons(
    String(mobileConfig?.[OrganizationConfigKey.MobileNavbarShowIcons] ?? ""),
    mobileShowIconsFromVariant,
  );

  let pinnedProfileDisplayName = "";
  let pinnedProfileRole = "";
  if (mobilePinnedUser && session?.user) {
    pinnedProfileDisplayName =
      session.user.name ?? (session.user.email as string | undefined) ?? "";
    if (orgId) {
      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        orgId,
      );
      if (membership?.role) {
        pinnedProfileRole =
          membership.role.charAt(0).toUpperCase() + membership.role.slice(1);
      }
    }
  }

  const mobileNav = {
    items: navbarItems,
    drawerSide: mobileDrawerSide,
    pinnedUser: mobilePinnedUser,
    showIcons: mobileShowIcons,
    pinnedProfileDisplayName,
    pinnedProfileRole,
  };

  if (variant === "vertical-icon") {
    return (
      <div className="flex h-screen overflow-hidden bg-brand-fill">
        <div className="hidden md:block">
          <VerticalIconNav items={navbarItems} />
        </div>
        <MobileSidebarNav {...mobileNav} />
        <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
      </div>
    );
  }

  if (
    variant === "horizontal-left" ||
    variant === "horizontal-center" ||
    variant === "horizontal-right"
  ) {
    const alignment =
      variant === "horizontal-left"
        ? "left"
        : variant === "horizontal-right"
          ? "right"
          : "center";

    return (
      <div className="flex min-h-screen flex-col bg-brand-fill">
        <div className="hidden md:block">
          <HorizontalNav items={navbarItems} alignment={alignment} />
        </div>
        <MobileSidebarNav {...mobileNav} />
        <main className="flex-1 overflow-auto px-6 py-4 pt-20 md:pt-4">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-fill">
      <div className="hidden md:block">
        <VerticalSidebarNav items={navbarItems} />
      </div>
      <MobileSidebarNav {...mobileNav} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
