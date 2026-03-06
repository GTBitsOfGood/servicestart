"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useNavbarVariant } from "@/components/NavbarVariantContext";
import { SunsetVerticalSidebarNav } from "@/components/navigation/SunsetVerticalSidebarNav";
import { SunsetVerticalIconNav } from "@/components/navigation/SunsetVerticalIconNav";
import { SunsetHorizontalNav } from "./navigation/SunsetHorizontalNav";

interface NavbarProps {
  children: ReactNode;
}

export default function Navbar({ children }: NavbarProps) {
  const pathname = usePathname();
  const { variant } = useNavbarVariant();

  // Do not render a navbar on auth-only routes
  if (pathname === "/login" || pathname === "/signup") {
    return <>{children}</>;
  }

  const isVertical =
    variant === "sunset-vertical-sidebar" || variant === "sunset-vertical-icon";

  const horizontalAlignment =
    variant === "sunset-horizontal-left"
      ? "left"
      : variant === "sunset-horizontal-right"
        ? "right"
        : "center";

  if (isVertical) {
    const VerticalComponent =
      variant === "sunset-vertical-icon"
        ? SunsetVerticalIconNav
        : SunsetVerticalSidebarNav;

    return (
      <div className="flex min-h-screen bg-[#FFF7F3]">
        <VerticalComponent />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FFF7F3]">
      <SunsetHorizontalNav alignment={horizontalAlignment} />
      <main className="flex-1 overflow-auto px-6 py-4">{children}</main>
    </div>
  );
}
