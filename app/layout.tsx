import "@/styles/globals.css";
import { Suspense } from "react";
import { ActiveOrganizationSync } from "../components/ActiveOrganizationSync";
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
        <Suspense fallback={children}>
          <Navbar>{children}</Navbar>
        </Suspense>
      </body>
    </html>
  );
}
