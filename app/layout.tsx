import "@/styles/globals.css";
import { type CSSProperties } from "react";
import { headers } from "next/headers";
import { ActiveOrganizationSync } from "@/core/tenant/components/ActiveOrganizationSync";
import NavbarWrapper from "@/features/navigation/components/NavbarWrapper";
import Navbar from "@/features/navigation/components/Navbar";
import NotificationToastProvider from "@/features/communications/components/NotificationToastProvider";
import { getSlugFromHost } from "@/core/tenant/clientAuthUtils";
import { OrganizationsService } from "@/core/tenant/OrganizationService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { OrganizationConfigKey } from "@/core/config/schema";
import {
  getOrganizationThemeCssVariables,
  isCornerStyle,
} from "@/core/config/theme";
import { themeFontVariableClassNames } from "@/app/fonts";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const slug = getSlugFromHost(headerList.get("host") ?? undefined);
  const organization = await OrganizationsService.findBySlug(slug);
  const themeConfig = organization
    ? await OrganizationConfigService.getThemeConfig(organization.id)
    : {};
  const themeVariables = getOrganizationThemeCssVariables(themeConfig);
  const hasConfiguredTheme = Object.keys(themeConfig).length > 0;
  const configuredCornerStyle = themeConfig[OrganizationConfigKey.CornerStyle];
  const cornerStyle =
    configuredCornerStyle && isCornerStyle(configuredCornerStyle)
      ? configuredCornerStyle
      : undefined;

  return (
    <html
      lang="en"
      className={themeFontVariableClassNames}
      style={themeVariables as CSSProperties}
      data-organization-theme={hasConfiguredTheme ? "custom" : undefined}
      data-corner-style={cornerStyle}
    >
      <body>
        <ActiveOrganizationSync />
        <NotificationToastProvider />
        <NavbarWrapper noNavbarChildren={children}>
          <Navbar>{children}</Navbar>
        </NavbarWrapper>
      </body>
    </html>
  );
}
