import { ReactNode } from "react";
import { VerticalSidebarNav } from "@/features/navigation/components/VerticalSidebarNav";
import { VerticalIconNav } from "@/features/navigation/components/VerticalIconNav";
import { HorizontalNavLayout } from "@/features/navigation/components/HorizontalNavLayout";
import {
  MobileSidebarNav,
  type MobileDrawerSide,
} from "@/features/navigation/components/MobileSidebarNav";
import { OrganizationConfigKey } from "@/core/config/schema";
import OrganizationConfigService, {
  ALLOWED_NAVBAR_VARIANTS,
  ALLOWED_MOBILE_NAVBAR_VARIANTS,
  resolveMobileShowIcons,
} from "@/core/config/OrganizationConfigService";
import { auth } from "@/core/auth/auth";
import { headers } from "next/headers";
import getNavbarItems from "@/features/navigation/getNavbarItems";
import { getActiveOrganizationIdFromHeaders } from "@/core/auth/authUtils";
import { MembersService } from "@/features/membership";
import OrganizationFooter from "@/features/navigation/components/OrganizationFooter";

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
