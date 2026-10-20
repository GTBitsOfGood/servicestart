"use client";

import type { ComponentProps } from "react";
import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";

type ThemedTextInputProps = ComponentProps<typeof BogTextInput>;

/** Applies the organization control radius around the BoG text input. */
export default function ThemedTextInput({
  className,
  ...props
}: ThemedTextInputProps) {
  return (
    <BogTextInput
      {...props}
      className={`themed-text-input ${className ?? ""}`.trim()}
    />
  );
}
