import React from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { MinusIcon, CheckIcon } from "@radix-ui/react-icons";
import styles from "./styles.module.css";

interface BogCheckboxProps extends React.ComponentProps<typeof Checkbox.Root> {
  /** The label text that appears to the right of the checkbox. */
  label?: string;
  /** Whether the checkbox is disabled or not. */
  disabled?: boolean;
  /** Whether the checkbox is checked or not. Values are true, false, or "indeterminate" */
  checked?: boolean | "indeterminate";
  /** Whether it is required to check this checkbox to submit the form. */
  required?: boolean;
  /** The name of the data this checkbox represents for forms. */
  name: string;
  /** Additional class names to apply styles to the checkbox. These can be tailwind classes or custom CSS classes. */
  className?: string;
  /** Additional CSS styles to apply to the checkbox. */
  style?: React.CSSProperties;
}

const BogCheckbox = ({
  label = "",
  disabled = false,
  checked,
  required = false,
  name,
  style,
  className,
  ...props
}: BogCheckboxProps) => {
  return (
    <div
      style={style}
      className={`${styles.checkboxContainer} ${disabled ? styles.disabled : ""} ${checked === "indeterminate" ? styles.indeterminate : ""} ${className}`}
    >
      <Checkbox.Root
        className={`${styles.checkbox} ${disabled ? styles.disabled : ""}`}
        disabled={disabled}
        checked={checked}
        required={required}
        name={name}
        {...props}
      >
        <Checkbox.Indicator className={styles.checkboxIndicator}>
          {checked === "indeterminate" ? (
            <MinusIcon className={styles.checkboxIcon} />
          ) : (
            <CheckIcon className={styles.checkboxIcon} />
          )}
        </Checkbox.Indicator>
      </Checkbox.Root>
      {label && (
        <label
          className={`${styles.checkboxLabel} ${disabled ? styles.disabled : ""} ${checked === "indeterminate" ? styles.indeterminate : ""}`}
        >
          {label}
        </label>
      )}
    </div>
  );
};

export default BogCheckbox;
