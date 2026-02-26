import React from "react";
import { Callout } from "@radix-ui/themes";
import clsx from "clsx";
import styles from "./styles.module.css";
import BogIcon from "../BogIcon/BogIcon";

export type BannerType =
  | "success"
  | "error"
  | "warning"
  | "message"
  | "brand-message";
export type BannerVariant = "filled" | "surface" | "outlined";
export type BogBannerType = BannerType;
export type BogBannerVariant = BannerVariant;
type BogIconLikeProps = React.ComponentProps<typeof BogIcon>;

export interface BogBannerProps extends Omit<
  React.ComponentProps<typeof Callout.Root>,
  "variant" | "content"
> {
  type: BannerType;
  variant?: BannerVariant;
  iconProps?: BogIconLikeProps;
  content: React.ReactElement;
  className?: string;
  style?: React.CSSProperties;
  role?: React.AriaRole;
  highContrast?: boolean;
}

const TYPE_CLASS: Record<BannerType, string> = {
  success: styles.success,
  error: styles.error,
  warning: styles.warning,
  message: styles.message,
  "brand-message": styles.brandMessage,
};

function defaultIconFor(type: BannerType): BogIconLikeProps["name"] {
  switch (type) {
    case "success":
      return "success";
    case "error":
      return "error";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

export default function BogBanner({
  type,
  variant = "filled",
  iconProps,
  content,
  className,
  style,
  role,
  highContrast,
  ...rest
}: BogBannerProps) {
  const rootClass = clsx(
    styles.root,
    TYPE_CLASS[type],
    styles[variant],
    className,
  );

  const computedRole: React.AriaRole | undefined =
    role ?? (type === "error" || type === "warning" ? "alert" : undefined);

  const baseName = iconProps?.name ?? defaultIconFor(type);
  const forcedWeight =
    iconProps?.weight ?? (variant === "filled" ? "fill" : "regular");

  const iconNode = (
    <BogIcon
      {...iconProps}
      name={baseName}
      weight={forcedWeight}
      size={iconProps?.size ?? "1em"}
      color={iconProps?.color ?? "currentColor"}
    />
  );

  return (
    <Callout.Root
      variant="surface"
      highContrast={highContrast}
      role={computedRole}
      className={rootClass}
      style={style}
      {...rest}
    >
      <div className={styles.inner}>
        <Callout.Icon className={styles.icon}>{iconNode}</Callout.Icon>
        <Callout.Text>{content}</Callout.Text>
      </div>
    </Callout.Root>
  );
}

(BogBanner as any).displayName = "BogBanner";
