import "@/styles/globals.css";
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
        <NavbarVariantProvider>
          <Navbar>{children}</Navbar>
        </NavbarVariantProvider>
      </body>
    </html>
  );
}
