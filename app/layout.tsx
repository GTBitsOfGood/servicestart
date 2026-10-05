import "@/styles/globals.css";
import { Suspense } from "react";
import { ActiveOrganizationSync } from "../components/ActiveOrganizationSync";
import NavbarWrapper from "@/components/navigation/NavbarWrapper";
import Navbar from "@/components/navigation/Navbar";
import NotificationToastProvider from "@/components/notifications/NotificationToastProvider";
import { headers } from "next/headers";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import OrganizationNotFound from "@/components/OrganizationNotFound";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "localhost:3000";
  const slug = getSlugFromHost(host);
  // Loopback also supports test sessions with an explicit active organization.
  const organization =
    slug === "servicestart" || (await OrganizationsService.findBySlug(slug));
  const protocol =
    requestHeaders.get("x-forwarded-proto") === "https" ? "https:" : "http:";
  return (
    <html lang="en">
      <body>
        {!organization ? (
          <OrganizationNotFound host={host} protocol={protocol} />
        ) : (
          <>
            <ActiveOrganizationSync />
            <NotificationToastProvider />
            <Suspense fallback={children}>
              <NavbarWrapper noNavbarChildren={children}>
                <Navbar>{children}</Navbar>
              </NavbarWrapper>
            </Suspense>
          </>
        )}
      </body>
    </html>
  );
}
