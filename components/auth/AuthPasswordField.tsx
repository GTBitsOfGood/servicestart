"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import AuthTextField, {
  type AuthTextFieldProps,
} from "@/components/auth/AuthTextField";
import { FOCUS_RING } from "@/components/auth/authStyles";
import { cn } from "@/lib/utils";

type AuthPasswordFieldProps = Omit<AuthTextFieldProps, "type" | "endAdornment">;

/** A password input with a button that shows or hides what was typed. */
export default function AuthPasswordField(props: AuthPasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeSlashIcon : EyeIcon;

  return (
    <AuthTextField
      {...props}
      type={visible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${props.label}` : `Show ${props.label}`}
          aria-pressed={visible}
          className={cn(
            "flex size-10 items-center justify-center rounded-control text-grey-icon-strong hover:bg-grey-fill-weak",
            FOCUS_RING,
          )}
        >
          <Icon size={20} aria-hidden />
        </button>
      }
    />
  );
}
