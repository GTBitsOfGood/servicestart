import "@/styles/globals.css";
import { Suspense } from "react";
import { ActiveOrganizationSync } from "../components/ActiveOrganizationSync";
import { NavbarVariantProvider } from "../components/NavbarVariantContext";
import Navbar from "@/components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ActiveOrganizationSync />
        <Suspense fallback={null}>
          <NavbarVariantProvider>
            <Navbar>{children}</Navbar>
          </NavbarVariantProvider>
        </Suspense>
      </body>
    </html>
  );
}
