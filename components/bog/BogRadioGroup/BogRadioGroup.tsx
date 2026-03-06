import React, { ComponentProps } from "react";
import { RadioGroup } from "radix-ui";
import styles from "./styles.module.css";

interface BogRadioGroupProps extends ComponentProps<typeof RadioGroup.Root> {
  /** The content that appears inside the radio group. */
  children: React.ReactNode;
  /** Additional class names to apply styles to the radio group. These can be tailwind classes or custom CSS classes. */
  className?: string;
  /** Additional CSS styles to apply to the radio group. */
  style?: React.CSSProperties;
}

export default function BogRadioGroup({
  children,
  ...props
}: BogRadioGroupProps) {
  return (
    <RadioGroup.Root
      {...props}
      className={`${styles.root} ${props.className || ""}`}
    >
      {children}
    </RadioGroup.Root>
  );
}
