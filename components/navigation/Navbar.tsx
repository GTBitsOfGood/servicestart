import { ReactNode } from "react";
import { VerticalSidebarNav } from "@/components/navigation/VerticalSidebarNav";
import { VerticalIconNav } from "@/components/navigation/VerticalIconNav";
import { HorizontalNav } from "@/components/navigation/HorizontalNav";
import { MobileSidebarNav } from "@/components/navigation/MobileSidebarNav";
import { OrganizationConfigKey } from "@/lib/schema";
import OrganizationConfigService, {
  ALLOWED_NAVBAR_VARIANTS,
  ALLOWED_MOBILE_NAVBAR_VARIANTS,
  resolveMobileProfileOrientation,
  resolveMobileShowIcons,
} from "@/lib/services/OrganizationConfigService";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import getNavbarItems from "@/lib/getNavbarItems";
import { getActiveOrganizationIdFromHeaders } from "@/lib/authUtils";

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
          OrganizationConfigKey.MobileNavbarProfileOrientation,
        ])
      : null,
  ]);

  const variant: (typeof ALLOWED_NAVBAR_VARIANTS)[number] =
    variantConfig?.[OrganizationConfigKey.NavbarVariant] ?? "vertical-sidebar";

  const mobileVariant: (typeof ALLOWED_MOBILE_NAVBAR_VARIANTS)[number] =
    mobileConfig?.[OrganizationConfigKey.MobileNavbarVariant] ??
    "mobile-left-sidebar";

  const navbarItems = await getNavbarItems(session, orgId);

  const mobileDrawerSide = mobileVariant.includes("right") ? "right" : "left";
  const mobilePinnedUser = mobileVariant.includes("pinned");
  const mobileShowIconsFromVariant =
    mobileVariant.includes("icons") ||
    (mobileDrawerSide === "right" && !mobileVariant.includes("no-icons"));
  const mobileShowIcons = resolveMobileShowIcons(
    String(mobileConfig?.[OrganizationConfigKey.MobileNavbarShowIcons] ?? ""),
    mobileShowIconsFromVariant,
  );
  const mobileProfileOrientation = resolveMobileProfileOrientation(
    String(
      mobileConfig?.[OrganizationConfigKey.MobileNavbarProfileOrientation] ??
        "",
    ),
  );

  if (variant === "vertical-icon") {
    return (
      <div className="flex h-screen overflow-hidden bg-brand-fill">
        <div className="hidden md:block">
          <VerticalIconNav items={navbarItems} />
        </div>
        <MobileSidebarNav
          items={navbarItems}
          drawerSide={mobileDrawerSide}
          pinnedUser={mobilePinnedUser}
          showIcons={mobileShowIcons}
          profileAvatarOrientation={mobileProfileOrientation}
        />
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
        <MobileSidebarNav
          items={navbarItems}
          drawerSide={mobileDrawerSide}
          pinnedUser={mobilePinnedUser}
          showIcons={mobileShowIcons}
          profileAvatarOrientation={mobileProfileOrientation}
        />
        <main className="flex-1 overflow-auto px-6 py-4 pt-20 md:pt-4">
          {children}
        </main>
      </div>
    );
  }

  // Default: vertical sidebar
  return (
    <div className="flex h-screen overflow-hidden bg-brand-fill">
      <div className="hidden md:block">
        <VerticalSidebarNav items={navbarItems} />
      </div>
      <MobileSidebarNav
        items={navbarItems}
        drawerSide={mobileDrawerSide}
        pinnedUser={mobilePinnedUser}
        showIcons={mobileShowIcons}
        profileAvatarOrientation={mobileProfileOrientation}
      />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
