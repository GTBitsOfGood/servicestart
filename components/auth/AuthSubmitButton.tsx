"use client";

import type { ReactNode } from "react";
import BogButton from "@/components/bog/BogButton/BogButton";
import { FOCUS_RING } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";

type AuthSubmitButtonProps = {
  children: ReactNode;
  /** Disables the button so a pending request can't be sent twice. */
  pending?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
};

/** The full-width primary action at the bottom of an auth card. */
export default function AuthSubmitButton({
  children,
  pending = false,
  type = "submit",
  onClick,
}: AuthSubmitButtonProps) {
  return (
    <BogButton
      type={type}
      onClick={onClick}
      disabled={pending}
      aria-busy={pending || undefined}
      size="large"
      className={cn("w-full rounded-control text-brand-foreground", FOCUS_RING)}
    >
      {children}
    </BogButton>
  );
}
