import "@/styles/globals.css";
import { Suspense } from "react";
import { ActiveOrganizationSync } from "../components/ActiveOrganizationSync";
import NavbarWrapper from "@/components/navigation/NavbarWrapper";
import Navbar from "@/components/navigation/Navbar";
import NotificationToastProvider from "@/components/notifications/NotificationToastProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
