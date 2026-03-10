"use client";

import { NO_NAVBAR_PAGES } from "@/lib/navbar";
import { usePathname } from "next/navigation";
import React from "react";

export default function NavbarWrapper({
  children,
  noNavbarChildren,
}: {
  children: React.ReactNode;
  noNavbarChildren: React.ReactNode;
}) {
  const pathname = usePathname();

  if (NO_NAVBAR_PAGES.includes(pathname)) {
    return <>{noNavbarChildren}</>;
  }

  return children;
}
