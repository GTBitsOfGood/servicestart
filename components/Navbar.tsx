"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { VerticalSidebarNav } from "@/components/navigation/VerticalSidebarNav";
import { VerticalIconNav } from "@/components/navigation/VerticalIconNav";
import { HorizontalNav } from "@/components/navigation/HorizontalNav";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import { OrganizationConfigKey } from "@/lib/schema";

interface NavbarProps {
  children: ReactNode;
}

export default function Navbar({ children }: NavbarProps) {
  const pathname = usePathname();
  const config = useOrganizationConfig([OrganizationConfigKey.NavbarVariant]);

  const rawVariant = config[OrganizationConfigKey.NavbarVariant];
  const variant = (rawVariant || "vertical-sidebar") as string;

  // Do not render a navbar on auth-only routes
  if (pathname === "/login" || pathname === "/signup") {
    return <>{children}</>;
  }

  // Determine layout based on organization config
  if (variant === "vertical-icon") {
    return (
      <div className="flex min-h-screen bg-brand-fill">
        <VerticalIconNav />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    );
  }

  if (
    variant === "horizontal-left" ||
    variant === "horizontal-center" ||
    variant === "horizontal-right"
  ) {
    const alignment =
      variant === "horizontal-left"
        ? "left"
        : variant === "horizontal-right"
          ? "right"
          : "center";

    return (
      <div className="flex min-h-screen flex-col bg-brand-fill">
        <HorizontalNav alignment={alignment} />
        <main className="flex-1 overflow-auto px-6 py-4">{children}</main>
      </div>
    );
  }

  // Default: vertical sidebar with text labels
  return (
    <div className="flex min-h-screen bg-brand-fill">
      <VerticalSidebarNav />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
