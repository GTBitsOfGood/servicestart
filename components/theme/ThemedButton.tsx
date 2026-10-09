"use client";

import type { ComponentProps } from "react";
import BogButton from "@/components/bog/BogButton/BogButton";

type ThemedButtonProps = ComponentProps<typeof BogButton>;

/**
 * Applies organization-level control and contrast tokens without modifying
 * the shared BoG primitive.
 */
export default function ThemedButton({
  variant = "primary",
  className,
  style,
  ...props
}: ThemedButtonProps) {
  return (
    <BogButton
      {...props}
      variant={variant}
      className={`themed-button ${className ?? ""}`.trim()}
      style={{
        ...(variant === "primary"
          ? { color: "var(--color-brand-foreground)" }
          : {}),
        ...(variant === "secondary"
          ? { backgroundColor: "var(--color-page-bg)" }
          : {}),
        ...style,
      }}
    />
  );
}
