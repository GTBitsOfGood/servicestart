import { ReactNode } from "react";
import { VerticalSidebarNav } from "@/features/navigation/components/VerticalSidebarNav";
import { VerticalIconNav } from "@/features/navigation/components/VerticalIconNav";
import { HorizontalNavLayout } from "@/features/navigation/components/HorizontalNavLayout";
import {
  MobileSidebarNav,
  type MobileDrawerSide,
} from "@/features/navigation/components/MobileSidebarNav";
import { OrganizationConfigKey } from "@/core/config/schema";
import OrganizationConfigService from "@/core/config/OrganizationConfigService";
import {
  mobileNavbarShowIcons,
  mobileNavbarVariant,
  mobileVariantShowsIcons,
  navbarVariant,
  resolveMobileShowIcons,
} from "@/features/navigation/config";
import { auth } from "@/core/auth/auth";
import { headers } from "next/headers";
import getNavbarItems from "@/features/navigation/getNavbarItems";
import { getActiveOrganizationIdFromHeaders } from "@/core/auth/authUtils";
import { MembersService } from "@/features/membership/server";
import OrganizationFooter from "@/features/navigation/components/OrganizationFooter";

interface NavbarProps {
  children: ReactNode;
}

export default async function Navbar({ children }: NavbarProps) {
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });
  const orgId = await getActiveOrganizationIdFromHeaders(headerList);

  const config = orgId
    ? await OrganizationConfigService.getConfig(orgId, [
        OrganizationConfigKey.NavbarVariant,
        OrganizationConfigKey.MobileNavbarVariant,
        OrganizationConfigKey.MobileNavbarShowIcons,
      ])
    : null;

  const variant =
    config?.[OrganizationConfigKey.NavbarVariant] ?? navbarVariant.default;
  const mobileVariant =
    config?.[OrganizationConfigKey.MobileNavbarVariant] ??
    mobileNavbarVariant.default;

  const navbarItems = await getNavbarItems(session, orgId);

  const mobileDrawerSide: MobileDrawerSide = mobileVariant.includes("right")
    ? "right"
    : "left";
  const mobilePinnedUser = mobileVariant.includes("pinned");
  const mobileShowIcons = resolveMobileShowIcons(
    config?.[OrganizationConfigKey.MobileNavbarShowIcons] ??
      mobileNavbarShowIcons.default,
    mobileVariantShowsIcons(mobileVariant),
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

  // Below every page's content, in every layout.
  const footer = orgId ? <OrganizationFooter organizationId={orgId} /> : null;
  const content = (
    <>
      {children}
      {footer}
    </>
  );

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
      <div className="flex h-screen overflow-hidden bg-app-shell-bg">
        <div className="hidden md:block">
          <VerticalIconNav items={navbarItems} />
        </div>
        <MobileSidebarNav {...mobileNav} />
        <main className="flex-1 overflow-auto pt-14 md:pt-0">{content}</main>
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
      <HorizontalNavLayout
        alignment={alignment}
        mobileNav={mobileNav}
        footer={footer}
      >
        {children}
      </HorizontalNavLayout>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-app-shell-bg">
      <div className="hidden md:block">
        <VerticalSidebarNav items={navbarItems} />
      </div>
      <MobileSidebarNav {...mobileNav} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{content}</main>
    </div>
  );
}
