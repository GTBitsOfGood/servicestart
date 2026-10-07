"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AuthTextFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  /** Shown under the input and announced; also marks the input invalid. */
  error?: string;
  /** Shown under the input when there's no error, e.g. a password policy. */
  hint?: string;
  readOnly?: boolean;
  /** Rendered inside the input's right edge, e.g. a show/hide toggle. */
  endAdornment?: ReactNode;
};

/** A labelled text input with an inline error, styled from theme tokens. */
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
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-mobile-paragraph-2 font-semibold text-page-text"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            "w-full rounded-control border border-grey-stroke-strong bg-page-bg px-4 py-3 text-mobile-paragraph-1 text-page-text placeholder:text-grey-text-weak",
            "focus-visible:border-brand-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text",
            "aria-invalid:border-status-red-text read-only:bg-grey-fill-weak read-only:text-grey-text-weak",
            endAdornment && "pr-14",
          )}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {endAdornment}
          </div>
        )}
      </div>
      {message && (
        <p
          id={messageId}
          className={cn(
            "text-mobile-paragraph-2",
            error ? "text-status-red-text" : "text-grey-text-weak",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/** Focuses the form's first invalid field once React has rendered the errors. */
export function focusFirstInvalidField(form: HTMLFormElement) {
  requestAnimationFrame(() =>
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}
