"use client";

import ChoiceOption from "@/features/forms/components/questions/ChoiceOption";
import ClearAnswerButton from "@/features/forms/components/questions/ClearAnswerButton";
import QuestionField from "@/features/forms/components/questions/QuestionField";
import {
  describedBy,
  fieldId,
  groupBlur,
  type QuestionProps,
} from "@/features/forms/components/types";
import type { FormComponentOfType } from "@/features/forms/lib/schema";
import type { FormComponentType } from "@/features/forms/schema";

/** Radio buttons; the answer is the chosen option's text. */
export default function SingleChoiceQuestion({
  component,
  value,
  error,
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<FormComponentType.SingleChoice>>) {
  const { options } = component.config;
  // Errors focus the chosen option, or the first.
  const focusIndex = Math.max(options.indexOf(value as string), 0);

  return (
    <QuestionField component={component} error={error} group>
      <div
        role="radiogroup"
        aria-readonly={readOnly || undefined}
        aria-required={component.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(component, error)}
        className="flex flex-col gap-2"
        onBlur={groupBlur(onBlur)}
      >
        {options.map((option, index) => (
          <ChoiceOption
            key={option}
            type="radio"
            label={option}
            id={
              index === focusIndex
                ? fieldId(component.id)
                : `${fieldId(component.id)}-${index}`
            }
            name={component.id}
            value={option}
            checked={value === option}
            disabled={disabled}
            readOnly={readOnly}
            onChange={() => {
              if (!readOnly) onChange(option);
            }}
          />
        ))}
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
