import { FileText } from "@phosphor-icons/react/ssr";
import type { ComponentProps } from "react";

type NoRequestIconProps = ComponentProps<typeof FileText>;

export default function NoRequestIcon(props: NoRequestIconProps) {
  return <FileText aria-hidden="true" size={36} weight="regular" {...props} />;
}
