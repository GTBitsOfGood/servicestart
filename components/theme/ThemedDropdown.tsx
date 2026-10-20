"use client";

import type { ComponentProps } from "react";
import BogDropdown from "@/components/bog/BogDropdown/BogDropdown";

type ThemedDropdownProps = ComponentProps<typeof BogDropdown>;

/** Applies organization contrast tokens without modifying the BoG primitive. */
export default function ThemedDropdown({
  className,
  variant = "secondary",
  ...props
}: ThemedDropdownProps) {
  return (
    <BogDropdown
      {...props}
      variant={variant}
      className={[
        "themed-dropdown",
        variant === "primary" ? "themed-dropdown-primary" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
