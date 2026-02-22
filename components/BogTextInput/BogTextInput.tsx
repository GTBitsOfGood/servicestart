import styles from "./styles.module.css";
import React, { useState } from "react";
import type { IconProps } from "../../utils/design-system/types/types";
import BogIcon from "../BogIcon/BogIcon";

interface BogTextInputProps {
  /** Whether or not the text input has multiple lines. */
  multiline?: boolean;
  /** The type of text the input stores. */
  type?: "text" | "email" | "password" | "tel" | "search";
  /** The name of the data this text input represents for forms. */
  name: string;
  /** The label text next to the input. */
  label?: string;
  /** The placeholder text in the text input when it is empty. */
  placeholder?: string;
  /** Whether or not the text input is required for form submission. */
  required?: boolean;
  /** Whether or not the text input is disabled. */
  disabled?: boolean;
  /** Additional class names to apply styles to the text input. These can be tailwind classes or custom CSS classes. */
  className?: string;
  /** Additional CSS styles to apply to the text input. */
  style?: React.CSSProperties;
  /** Optional icon configuration to render inside the input. */
  iconProps?: IconProps;
  /** The current value of the text input for controlled components. */
  value?: string;
  /** The default value of the text input for uncontrolled components. */
  defaultValue?: string;
  /** Function that is called when the value of the text input changes. */
  onChange?: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
}

export default function BogTextInput({
  type = "text",
  name,
  label,
  multiline = false,
  placeholder = "Enter text here",
  required = false,
  disabled = false,
  style,
  className,
  iconProps,
  value,
  defaultValue,
  onChange,
}: BogTextInputProps) {
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

  return (
    <div
      className={`${styles.container} ${className} text-paragraph-2`}
      style={style}
    >
      {label}
      <div
        className={`${styles.inputWrapper} ${
          iconProps &&
          (iconProps.position === "right" ? styles.iconRight : styles.iconLeft)
        }`}
      >
        {multiline ? (
          <textarea
            name={name}
            required={required}
            disabled={disabled}
            rows={4}
            placeholder={placeholder}
            className={`${styles.input} placeholder:text-paragraph-2 ${styles.multiline}`}
            value={currentValue}
            onChange={handleChange}
          />
        ) : (
          <input
            name={name}
            type={type}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            className={`${styles.input} placeholder:text-paragraph-2 `}
            value={currentValue}
            onChange={handleChange}
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
      </div>
    </div>
  );
}
