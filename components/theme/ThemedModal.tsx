"use client";

import type { ComponentProps } from "react";
import BogModal from "@/components/bog/BogModal/BogModal";

type ThemedModalProps = ComponentProps<typeof BogModal>;

/** Applies organization control tokens to the buttons owned by BogModal. */
export default function ThemedModal({
  primaryButtonClassName,
  primaryButtonStyle,
  secondaryButtonClassName,
  secondaryButtonStyle,
  ...props
}: ThemedModalProps) {
  return (
    <BogModal
      {...props}
      primaryButtonClassName={`themed-button ${primaryButtonClassName ?? ""}`.trim()}
      primaryButtonStyle={{
        color: "var(--color-brand-foreground)",
        ...primaryButtonStyle,
      }}
      secondaryButtonClassName={`themed-button ${secondaryButtonClassName ?? ""}`.trim()}
      secondaryButtonStyle={{
        backgroundColor: "var(--color-page-bg)",
        ...secondaryButtonStyle,
      }}
    />
  );
}
