import styles from "./styles.module.css";
import React, { useId, useState, type ReactNode } from "react";
import type { IconProps } from "../../../utils/design-system/types/types";
import BogIcon from "../BogIcon/BogIcon";
import { cn } from "@/lib/utils";

interface BogTextInputProps {
  /** Whether or not the text input has multiple lines. */
  multiline?: boolean;
  /** The type of text the input stores. */
  type?: "text" | "email" | "password" | "tel" | "search" | "date" | "time";
  /** The name of the data this text input represents for forms. */
  name: string;
  /** The label text next to the input. */
  label?: string;
  /** Associates the label with a specific control; auto-generated when omitted. */
  id?: string;
  /** The placeholder text in the text input when it is empty. */
  placeholder?: string;
  /** Whether or not the text input is required for form submission. */
  required?: boolean;
  /** Whether or not the text input is disabled. */
  disabled?: boolean;
  readOnly?: boolean;
  autoComplete?: string;
  /** Additional class names to apply styles to the text input. These can be tailwind classes or custom CSS classes. */
  className?: string;
  /** Additional CSS styles to apply to the text input. */
  style?: React.CSSProperties;
  /** Optional icon configuration to render inside the input. */
  iconProps?: IconProps;
  endAdornment?: ReactNode;
  /** The current value of the text input for controlled components. */
  value?: string;
  /** The default value of the text input for uncontrolled components. */
  defaultValue?: string;
  /** Whether the input has an error state (red outline) */
  error?: boolean;
  errorText?: string;
  hint?: string;
  /** Function that is called when the value of the text input changes. */
  onChange?: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}

export default function BogTextInput({
  type = "text",
  name,
  label,
  id: idProp,
  multiline = false,
  placeholder = "Enter text here",
  required = false,
  disabled = false,
  readOnly = false,
  autoComplete,
  style,
  className,
  iconProps,
  endAdornment,
  value,
  defaultValue,
  error,
  errorText,
  hint,
  onChange,
}: BogTextInputProps) {
  const generatedId = useId();
  const inputId = idProp ?? generatedId;
  const messageId = `${inputId}-message`;
  const hasError = Boolean(errorText) || error;
  const message = errorText ?? hint;

  const [internalValue, setInternalValue] = useState<string>(
    defaultValue ?? "",
  );
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
  };

  const inputClassName = cn(
    styles.input,
    "placeholder:text-paragraph-2",
    multiline && styles.multiline,
    endAdornment && "pr-14",
    readOnly && "bg-grey-fill-weak text-grey-text-weak",
  );

  return (
    <div
      className={`${styles.container} ${className} text-paragraph-2`}
      style={style}
    >
      {label && (
        <label htmlFor={inputId}>
          {label}
          {required && <span className="text-status-red-text"> *</span>}
        </label>
      )}
      <div
        className={`${styles.inputWrapper} ${
          iconProps &&
          (iconProps.position === "right" ? styles.iconRight : styles.iconLeft)
        } ${hasError ? "ring-1 ring-status-red-text rounded" : ""}`}
      >
        {multiline ? (
          <textarea
            id={inputId}
            name={name}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            rows={4}
            placeholder={placeholder}
            className={inputClassName}
            value={currentValue}
            onChange={handleChange}
            aria-invalid={errorText ? true : undefined}
            aria-describedby={message ? messageId : undefined}
          />
        ) : (
          <input
            id={inputId}
            name={name}
            type={type}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            autoComplete={autoComplete}
            placeholder={placeholder}
            className={inputClassName}
            value={currentValue}
            onChange={handleChange}
            aria-invalid={errorText ? true : undefined}
            aria-describedby={message ? messageId : undefined}
          />
        )}

        {iconProps && (
          <div
            className={`${styles.iconContainer} ${iconProps.onClick ? styles.clickable : ""}`}
            onClick={(e) => {
              if (iconProps.onClick) iconProps.onClick(e);
            }}
          >
            <BogIcon {...iconProps.iconProps} />
          </div>
        )}
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
            errorText ? "text-status-red-text" : "text-grey-text-weak",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
