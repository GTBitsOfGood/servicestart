import { X } from "@phosphor-icons/react/ssr";
import type { ComponentProps } from "react";

type DeniedStatusIconProps = ComponentProps<typeof X>;

export default function DeniedStatusIcon(props: DeniedStatusIconProps) {
  return <X aria-hidden="true" size={20} weight="bold" {...props} />;
}
