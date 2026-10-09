import "@/styles/globals.css";
import { Suspense, type CSSProperties } from "react";
import { headers } from "next/headers";
import { ActiveOrganizationSync } from "../components/ActiveOrganizationSync";
import NavbarWrapper from "@/components/navigation/NavbarWrapper";
import Navbar from "@/components/navigation/Navbar";
import NotificationToastProvider from "@/components/notifications/NotificationToastProvider";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { getOrganizationThemeCssVariables } from "@/lib/theme";
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

  return (
    <html
      lang="en"
      className={themeFontVariableClassNames}
      style={themeVariables as CSSProperties}
      data-organization-theme={hasConfiguredTheme ? "custom" : undefined}
    >
      <body>
        <ActiveOrganizationSync />
        <NotificationToastProvider />
        <Suspense fallback={children}>
          <NavbarWrapper noNavbarChildren={children}>
            <Navbar>{children}</Navbar>
          </NavbarWrapper>
        </Suspense>
      </body>
    </html>
  );
}
