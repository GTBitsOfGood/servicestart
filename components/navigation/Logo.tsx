"use client";

import React, { useEffect, useState } from "react";
import { OrganizationConfigKey } from "@/lib/schema";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import { cn } from "@/lib/utils";

type SunsetLogoSize = "sm" | "md";

interface SunsetLogoProps {
  size?: SunsetLogoSize;
  className?: string;
}

export function SunsetLogo({ size = "md", className }: SunsetLogoProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const config = useOrganizationConfig([OrganizationConfigKey.LogoUrl]);
  const customLogoSrc = config[OrganizationConfigKey.LogoUrl];

  const circleClass =
    size === "sm" ? "h-16 w-16" : size === "md" ? "h-18 w-18" : "h-18 w-18";
  const bogHeightClass = "h-[10px]";
  const sunsetHeightClass = "h-[15px]";

  const useCustomLogo = mounted && customLogoSrc && customLogoSrc.trim() !== "";

  if (useCustomLogo) {
    return (
      <div className={cn("flex items-center", className)}>
        <img
          src={customLogoSrc}
          alt="Organization logo"
          className={`${circleClass} w-auto`}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <img src="/logo.svg" alt="Logo" className={`${circleClass} w-auto`} />
      <div className="flex flex-col items-start">
        <img
          src="/bog.svg"
          alt="bits of good"
          className={`${bogHeightClass} w-auto pl-1`}
        />
        <img
          src="/sunset.svg"
          alt="sunset"
          className={`${sunsetHeightClass} w-auto`}
        />
      </div>
    </div>
  );
}
