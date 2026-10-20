"use client";

import AuthInput, { type AuthInputProps } from "@/components/auth/AuthInput";
import { AUTH_FIELD_CLASS } from "@/components/auth/authStyles";

export type AuthTextFieldProps = Pick<
  AuthInputProps,
  "name" | "autoComplete" | "placeholder" | "hint" | "readOnly" | "endAdornment"
> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  error?: string;
};

/** Auth-styled labelled input built on {@link AuthInput}. */
export default function AuthTextField({
  label,
  name,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  error,
  hint,
  readOnly,
  endAdornment,
}: AuthTextFieldProps) {
  return (
    <AuthInput
      label={label}
      name={name}
      type={type}
      autoComplete={autoComplete}
      placeholder={placeholder}
      value={value}
      readOnly={readOnly}
      errorText={error}
      hint={hint}
      endAdornment={endAdornment}
      className={AUTH_FIELD_CLASS}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/** Focuses the form's first invalid field once React has rendered the errors. */
export function focusFirstInvalidField(form: HTMLFormElement) {
  requestAnimationFrame(() =>
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}
