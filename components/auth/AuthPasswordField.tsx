"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import AuthTextField, {
  type AuthTextFieldProps,
} from "@/components/auth/AuthTextField";

export type AuthPasswordFieldProps = Omit<
  AuthTextFieldProps,
  "type" | "endAdornment"
>;

/** Password field with a show/hide toggle (Bog has no eye icons yet). */
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
          className="flex size-10 items-center justify-center rounded-control text-grey-icon-strong hover:bg-grey-fill-weak"
        >
          <Icon size={20} aria-hidden />
        </button>
      }
    />
  );
}
