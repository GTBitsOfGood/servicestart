"use client";

import type { ComponentProps } from "react";
import BogModal from "@/components/bog/BogModal/BogModal";

type ThemedModalProps = ComponentProps<typeof BogModal>;

/** Applies organization control tokens to the buttons owned by BogModal. */
export default function ThemedModal({
  primaryButtonStyle,
  secondaryButtonStyle,
  ...props
}: ThemedModalProps) {
  return (
    <BogModal
      {...props}
      primaryButtonStyle={{
        borderRadius: "var(--radius-control)",
        color: "var(--color-brand-foreground)",
        ...primaryButtonStyle,
      }}
      secondaryButtonStyle={{
        borderRadius: "var(--radius-control)",
        backgroundColor: "var(--color-page-bg)",
        ...secondaryButtonStyle,
      }}
    />
  );
}
