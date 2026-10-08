"use client";

import BogTextInput from "@/components/bog/BogTextInput/BogTextInput";

export type AuthTextFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  readOnly?: boolean;
  endAdornment?: React.ReactNode;
};

/** Auth-styled labelled input built on {@link BogTextInput}. */
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
    <BogTextInput
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
      className="w-full font-semibold text-page-text [&_label]:text-mobile-paragraph-2 [&_label]:font-semibold [&_label]:text-page-text [&_input]:rounded-control [&_input]:border-grey-stroke-strong [&_input]:bg-page-bg [&_input]:px-4 [&_input]:py-3 [&_input]:text-mobile-paragraph-1 [&_input]:text-page-text"
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
