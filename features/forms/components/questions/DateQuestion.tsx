"use client";

import QuestionField from "@/features/forms/components/questions/QuestionField";
import {
  describedBy,
  fieldId,
  type QuestionProps,
} from "@/features/forms/components/types";
import type { FormComponentOfType } from "@/features/forms/lib/schema";
import type { FormComponentType } from "@/features/forms/schema";
import { cn } from "@/core/utils/utils";

/** A date input; the answer is a calendar date like 2027-06-02. */
export default function DateQuestion({
  component,
  value,
  error,
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<FormComponentType.Date>>) {
  return (
    <QuestionField component={component} error={error}>
      <input
        id={fieldId(component.id)}
        name={component.id}
        type="date"
        min={component.config.min}
        max={component.config.max}
        required={component.required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(component, error)}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        onBlur={onBlur}
        className={cn(
          "w-full max-w-60 rounded-control border bg-solid-bg-sunken px-4 py-3 text-paragraph-2 text-page-text focus:border-brand-stroke-strong focus:outline-none disabled:cursor-not-allowed disabled:opacity-85",
          error
            ? "border-status-red-stroke-strong"
            : "border-grey-stroke-weak hover:border-brand-stroke-strong",
        )}
      />
    </QuestionField>
  );
}
