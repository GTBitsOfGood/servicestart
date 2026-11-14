import { auth } from "@/core/auth/auth";
import "@/styles/globals.css";
import { type CSSProperties } from "react";
import { headers } from "next/headers";
import { ActiveOrganizationSync } from "@/core/tenant/components/ActiveOrganizationSync";
import NavbarWrapper from "@/features/navigation/components/NavbarWrapper";
import Navbar from "@/features/navigation/components/Navbar";
import NotificationToastProvider from "@/features/communications/components/NotificationToastProvider";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
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
  const session = await auth.api.getSession({ headers: headerList });
  const organization = await resolveOrganization(headerList, session);
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
