import { Check } from "@phosphor-icons/react/ssr";
import type { ComponentProps } from "react";

type ApprovedStatusIconProps = ComponentProps<typeof Check>;

export default function ApprovedStatusIcon(props: ApprovedStatusIconProps) {
  return <Check aria-hidden="true" size={20} weight="bold" {...props} />;
}
