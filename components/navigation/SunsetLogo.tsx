"use client";

import React from "react";

type SunsetLogoSize = "sm" | "md";

interface SunsetLogoProps {
  size?: SunsetLogoSize;
}

export function SunsetLogo({ size = "md" }: SunsetLogoProps) {
  const circleClass =
    size === "sm" ? "h-16 w-16" : size === "md" ? "h-18 w-18" : "h-18 w-18";

  const bogHeightClass = size === "sm" ? "h-[10px]" : "h-[10px]";
  const sunsetHeightClass = size === "sm" ? "h-[15px]" : "h-[15px]";

  return (
    <div className="flex items-center">
      <img
        src="/logo.svg"
        alt="Sunset logo"
        className={`${circleClass} w-auto`}
      />
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
