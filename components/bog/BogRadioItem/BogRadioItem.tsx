import { RadioGroup } from "radix-ui";
import React, { useId } from "react";
import styles from "./styles.module.css";

interface BogRadioItemProps extends React.ComponentProps<
  typeof RadioGroup.Item
> {
  /** The label text next to the radio button. */
  label: string;
  /** The value that will be stored in a form. */
  value: string;
  /** Whether the radio item is disabled or not. */
  disabled?: boolean;
  /** Additional class names to apply styles to the radio item. These can be tailwind classes or custom CSS classes. */
  className?: string;
  /** Additional CSS styles to apply to the radio item. */
  style?: React.CSSProperties;
}

export default function BogRadioItem({
  label,
  value,
  disabled = false,
  className,
  style,
}: BogRadioItemProps) {
  const id = useId();
  return (
    <div
      style={style}
      className={`${styles.container} ${className}`}
      data-disabled={disabled}
    >
      <RadioGroup.Item
        className={styles.radio}
        value={value}
        disabled={disabled}
        id={id}
      >
        <RadioGroup.Indicator className={styles.indicator} />
      </RadioGroup.Item>
      <label className={styles.label} data-disabled={disabled}>
        {label}
      </label>
    </div>
  );
}
