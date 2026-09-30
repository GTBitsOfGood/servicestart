"use client";

import { isNoNavbarPage } from "@/lib/navbar";
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

  if (isNoNavbarPage(pathname)) {
    return <>{noNavbarChildren}</>;
  }

  return children;
}
