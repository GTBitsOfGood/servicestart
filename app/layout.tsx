import "@/styles/globals.css";
import { Suspense } from "react";
import "@/lib/query.server";
import { ActiveOrganizationSync } from "../components/ActiveOrganizationSync";
import Navbar from "@/components/Navbar";
import Providers from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ActiveOrganizationSync />
          <Suspense fallback={children}>
            <Navbar>{children}</Navbar>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
