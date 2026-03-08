"use server";

import { ReactNode } from "react";
import { VerticalSidebarNav } from "@/components/navigation/VerticalSidebarNav";
import { VerticalIconNav } from "@/components/navigation/VerticalIconNav";
import { HorizontalNav } from "@/components/navigation/HorizontalNav";
import { OrganizationConfigKey } from "@/lib/schema";
import OrganizationConfigService, {
  ALLOWED_NAVBAR_VARIANTS,
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
  const session = await auth.api.getSession({
    headers: headerList,
  });

  const orgId = await getActiveOrganizationIdFromHeaders(headerList);

  const variant: (typeof ALLOWED_NAVBAR_VARIANTS)[number] = orgId
    ? (
        await OrganizationConfigService.getConfig(orgId, [
          OrganizationConfigKey.NavbarVariant,
        ])
      )[OrganizationConfigKey.NavbarVariant]
    : "vertical-sidebar";

  const navbarItems = await getNavbarItems(session, orgId);

  // Determine layout based on organization config
  if (variant === "vertical-icon") {
    return (
      <div className="flex min-h-screen bg-brand-fill">
        <VerticalIconNav items={navbarItems} />
        <main className="flex-1 overflow-auto">{children}</main>
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
        <HorizontalNav items={navbarItems} alignment={alignment} />
        <main className="flex-1 overflow-auto px-6 py-4">{children}</main>
      </div>
    );
  }

  // Default: vertical sidebar with text labels
  return (
    <div className="flex min-h-screen bg-brand-fill">
      <VerticalSidebarNav items={navbarItems} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
