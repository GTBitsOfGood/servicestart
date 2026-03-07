"use client";

import React from "react";
import { OrganizationConfigKey } from "@/lib/schema";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";

type SunsetLogoSize = "sm" | "md";

interface SunsetLogoProps {
  size?: SunsetLogoSize;
}

export function SunsetLogo({ size = "md" }: SunsetLogoProps) {
  const config = useOrganizationConfig([OrganizationConfigKey.LogoUrl]);
  const customLogoSrc = config[OrganizationConfigKey.LogoUrl];

  const circleClass =
    size === "sm" ? "h-16 w-16" : size === "md" ? "h-18 w-18" : "h-18 w-18";
  const bogHeightClass = "h-[10px]";
  const sunsetHeightClass = "h-[15px]";

  // Org has a custom logo URL → single image
  if (customLogoSrc && customLogoSrc.trim() !== "") {
    return (
      <div className="flex items-center">
        <img
          src={customLogoSrc}
          alt="Organization logo"
          className={`${circleClass} w-auto`}
        />
      </div>
    );
  }

  // Default: full logo (circle + bits of good + sunset)
  return (
    <div className="flex items-center">
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
