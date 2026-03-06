"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SunsetVerticalSidebarNav } from "@/components/navigation/SunsetVerticalSidebarNav";

interface NavbarProps {
  children: ReactNode;
}

export default function Navbar({ children }: NavbarProps) {
  const pathname = usePathname();

  // Do not render a navbar on auth-only routes
  if (pathname === "/login" || pathname === "/signup") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-brand-fill">
      <SunsetVerticalSidebarNav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
