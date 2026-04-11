import { Question } from "@phosphor-icons/react/ssr";
import type { ComponentProps } from "react";

type HelpIconProps = ComponentProps<typeof Question>;

export default function HelpIcon(props: HelpIconProps) {
  return <Question aria-hidden="true" size={16} weight="regular" {...props} />;
}
