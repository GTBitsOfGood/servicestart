import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

/** The fill, border, and focus styling shared by the text-entry controls. */
export function textControlClassName(
  hasError: boolean,
  ...extra: ClassValue[]
) {
  return cn(
    "w-full rounded-control border bg-solid-bg-sunken px-4 py-3 text-paragraph-2 text-page-text focus:border-brand-stroke-strong focus:outline-none disabled:cursor-not-allowed disabled:opacity-85",
    hasError
      ? "border-status-red-stroke-strong"
      : "border-grey-stroke-weak hover:border-brand-stroke-strong",
    ...extra,
  );
}
