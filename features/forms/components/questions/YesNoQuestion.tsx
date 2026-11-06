"use client";

import ClearAnswerButton from "@/features/forms/components/questions/ClearAnswerButton";
import QuestionField from "@/features/forms/components/questions/QuestionField";
import {
  describedBy,
  fieldId,
  groupBlur,
  type QuestionProps,
} from "@/features/forms/components/types";
import type { FormComponentOfType } from "@/features/forms/lib/schema";
import type { FormComponentType } from "@/lib/schema";
import { cn } from "@/core/utils/utils";

const CHOICES = [
  { label: "Yes", answer: true },
  { label: "No", answer: false },
] as const;

/** Two selection buttons; the answer is true for yes and false for no. */
export default function YesNoQuestion({
  component,
  value,
  error,
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<FormComponentType.YesNo>>) {
  const descriptionIds = describedBy(component, error);

  return (
    <QuestionField component={component} error={error} group>
      <div className="flex gap-3" onBlur={groupBlur(onBlur)}>
        {CHOICES.map(({ label, answer }) => {
          const selected = value === answer;
          return (
            <button
              key={label}
              type="button"
              // Errors focus the first button.
              id={answer ? fieldId(component.id) : undefined}
              aria-pressed={selected}
              aria-describedby={descriptionIds}
              disabled={disabled}
              onClick={() => {
                if (!readOnly) onChange(answer);
              }}
              className={cn(
                "min-w-24 rounded-control border px-6 py-3 text-paragraph-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-stroke-strong disabled:cursor-not-allowed disabled:opacity-85",
                selected
                  ? "border-brand-text bg-brand-text text-brand-foreground"
                  : "border-grey-stroke-weak bg-page-bg text-page-text",
                !selected &&
                  !readOnly &&
                  !disabled &&
                  "hover:border-brand-stroke-strong",
                readOnly && "cursor-default",
                error && !selected && "border-status-red-stroke-strong",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {!component.required && !readOnly && !disabled && value !== undefined && (
        <ClearAnswerButton
          label={component.label}
          onClear={() => onChange(undefined)}
        />
      )}
    </QuestionField>
  );
}
