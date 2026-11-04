import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ChoiceOptionProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  type: "radio" | "checkbox";
  label: string;
};

/** One radio button or checkbox with its label, as a selectable row. */
export default function ChoiceOption({
  type,
  label,
  ...inputProps
}: ChoiceOptionProps) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-control border border-grey-stroke-weak bg-page-bg px-4 py-3 text-paragraph-2 text-page-text",
        "has-checked:border-brand-stroke-strong has-checked:bg-brand-fill has-focus-visible:outline-2 has-focus-visible:outline-brand-stroke-strong",
        inputProps.disabled
          ? "cursor-not-allowed opacity-85"
          : !inputProps.readOnly &&
              "cursor-pointer hover:border-brand-stroke-strong",
      )}
    >
      <input
        {...inputProps}
        type={type}
        className="size-4 shrink-0 accent-brand-text focus:outline-none"
      />
      {label}
    </label>
  );
}
