import React from "react";
import type BogIcon from "@/components/BogIcon/BogIcon";

/**
 * IconProps describes a small configuration object used to render icons
 * consistently across components (buttons, inputs, etc.).
 */
export interface IconProps {
  /**
   * The React component props for the icon to render.
   */
  iconProps: React.ComponentProps<typeof BogIcon>;

  /** Position of the icon relative to the host component. */
  position: "left" | "right";

  /** Optional click handler for interactive icons (e.g., inside text inputs). */
  onClick?: (e: React.MouseEvent) => void;
}
