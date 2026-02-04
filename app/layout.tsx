import "@/styles/globals.css";
import { ActiveOrganizationSync } from "./ActiveOrganizationSync";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ActiveOrganizationSync />
        {children}
      </body>
    </html>
  );
}
