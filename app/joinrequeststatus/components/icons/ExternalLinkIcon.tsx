import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import type { ComponentProps } from "react";

type ExternalLinkIconProps = ComponentProps<typeof ArrowUpRight>;

export default function ExternalLinkIcon(props: ExternalLinkIconProps) {
  return <ArrowUpRight aria-hidden="true" size={14} weight="bold" {...props} />;
}
