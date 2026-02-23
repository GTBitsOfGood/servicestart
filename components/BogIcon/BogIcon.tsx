import React, { ElementType } from "react";
import * as PhosphorIcons from "@phosphor-icons/react";
import "./styles.module.css";

export type IconName =
  | "arrow-fat-up"
  | "arrow-fat-down"
  | "arrow-fat-left"
  | "arrow-fat-right"
  | "chevron-up"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "caret-up"
  | "caret-down"
  | "caret-left"
  | "caret-right"
  | "arrow-up"
  | "arrow-down"
  | "arrow-left"
  | "arrow-right"
  | "check"
  | "map-pin"
  | "chats"
  | "hand-heart"
  | "calendar"
  | "users"
  | "download"
  | "pushpin"
  | "close"
  | "search"
  | "trash"
  | "share"
  | "copy"
  | "gear"
  | "info"
  | "pause"
  | "play"
  | "user"
  | "folder"
  | "bell"
  | "plus"
  | "x"
  | "error"
  | "warning"
  | "success"
  | "funnel-simple";

// Include all props from Phosphor Icons
interface BogIconProps extends React.ComponentProps<
  typeof PhosphorIcons.XIcon
> {
  /** The unique name that identifies the icon. */
  name: IconName;
  /** The size of the icon, can be a number of pixels or a string with CSS units. */
  size?: number | string;
  /** The color of the icon. */
  color?: string;
  /**
   * The weight of the icon. Options are 'thin', 'light',
   * 'regular', 'bold', 'fill', or 'duotone'.
   */
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  /** Whether the icon is flipped horizontally or not. */
  mirrored?: boolean;
  /** The alt text of the icon. */
  alt?: string;
  /** Additional class names to apply styles to the icon. These can be tailwind classes or custom CSS classes. */
  className?: string;
  /** Additional CSS styles to apply to the icon. */
  style?: React.CSSProperties;
}

const weightFillIcons = new Set([
  "map-pin",
  "chats",
  "calendar",
  "users",
  "pushpin",
  "close",
  "trash",
  "share",
  "copy",
  "gear",
  "pause",
  "play",
  "user",
  "folder",
  "bell",
  "arrow-fat-up",
  "arrow-fat-down",
  "arrow-fat-left",
  "arrow-fat-right",
  "hand-heart",
  "download",
]);

const boldFillIcons = new Set([
  "check",
  "search",
  "info",
  "plus",
  "x",
  "success",
  "error",
  "warning",
  "arrow-up",
  "arrow-down",
  "arrow-left",
  "arrow-right",
]);

const BogIcon: React.FC<BogIconProps> = ({
  name,
  size,
  color,
  weight: customWeight,
  mirrored,
  alt,
  className,
  style,
}) => {
  // Map special names to actual Phosphor components
  const iconMap: Record<string, string> = {
    chats: "ChatsCircle",
    calendar: "CalendarDots",
    download: "DownloadSimple",
    pushpin: "PushPinSimple",
    close: "XCircle",
    search: "MagnifyingGlass",
    share: "ShareFat",
    copy: "CopySimple",
    user: "UserCircle",
    folder: "FolderSimple",
    bell: "BellSimpleRinging",
    success: "CheckCircle",
    error: "WarningOctagon",
  };

  const isChevron = name.startsWith("chevron-");
  const isCaret = name.startsWith("caret-");
  let iconName: string | undefined = iconMap[name];

  if (isChevron) {
    const dir = name.split("-")[1];
    const chevronName = "Chevron" + dir.charAt(0).toUpperCase() + dir.slice(1);
    const caretName = "Caret" + dir.charAt(0).toUpperCase() + dir.slice(1);
    iconName = PhosphorIcons[chevronName as keyof typeof PhosphorIcons]
      ? chevronName
      : caretName;
  } else if (isCaret) {
    const dir = name.split("-")[1];
    iconName = "Caret" + dir.charAt(0).toUpperCase() + dir.slice(1);
  } else if (iconName === undefined) {
    iconName =
      name.charAt(0).toUpperCase() +
      name.slice(1).replace(/-(.)/g, (_, c: string) => c.toUpperCase());
  }

  // Get the icon component from PhosphorIcons
  const IconComponent =
    (PhosphorIcons[iconName as keyof typeof PhosphorIcons] as ElementType) ||
    null;

  if (!IconComponent) {
    console.warn(
      `BogIcon: Unknown icon name "${name}" (resolved to "${iconName}")`,
    );
    return null;
  }
  // Only use default weight if custom weight is not provided
  let weight = customWeight;
  if (!weight) {
    if (isCaret) {
      weight = "fill";
    } else if (boldFillIcons.has(name)) {
      weight = "bold";
    } else if (weightFillIcons.has(name)) {
      weight = "fill";
    } else {
      weight = "regular";
    }
  }

  return (
    <IconComponent
      weight={weight}
      size={size}
      color={color}
      mirrored={mirrored}
      alt={alt}
      className={className}
      style={style}
    />
  );
};

export default BogIcon;
