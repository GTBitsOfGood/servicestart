"use client";

import ChoiceOption from "@/components/forms/questions/ChoiceOption";
import QuestionField from "@/components/forms/questions/QuestionField";
import {
  describedBy,
  fieldId,
  groupBlur,
  type QuestionProps,
} from "@/components/forms/types";
import type { FormComponentOfType } from "@/lib/forms/schema";
import type { FormComponentType } from "@/lib/schema";

function selectionHint(minSelected?: number, maxSelected?: number) {
  if (minSelected !== undefined && maxSelected !== undefined)
    return minSelected === maxSelected
      ? `Choose ${minSelected}.`
      : `Choose ${minSelected} to ${maxSelected}.`;
  if (minSelected) return `Choose at least ${minSelected}.`;
  if (maxSelected !== undefined) return `Choose up to ${maxSelected}.`;
  return null;
}

/** Checkboxes; the answer is the chosen options' text, in option order. */
export default function CheckboxesQuestion({
  component,
  value,
  error,
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<FormComponentType.Checkboxes>>) {
  const { options, minSelected, maxSelected } = component.config;
  const selected = Array.isArray(value) ? value : [];
  const hint = selectionHint(minSelected, maxSelected);
  const hintId = `${fieldId(component.id)}-hint`;
  const descriptionIds = describedBy(
    component,
    error,
    ...(hint && !readOnly ? [hintId] : []),
  );

  function toggle(option: string, checked: boolean) {
    if (readOnly) return;
    const next = options.filter((item) =>
      item === option ? checked : selected.includes(item),
    );
    onChange(next.length > 0 ? next : undefined);
  }

  return (
    <QuestionField component={component} error={error} group>
      {hint && !readOnly && (
        <p id={hintId} className="text-paragraph-2 text-grey-text-weak">
          {hint}
        </p>
      )}
      <div className="flex flex-col gap-2" onBlur={groupBlur(onBlur)}>
        {options.map((option, index) => (
          <ChoiceOption
            key={option}
            type="checkbox"
            label={option}
            id={
              index === 0
                ? fieldId(component.id)
                : `${fieldId(component.id)}-${index}`
            }
            name={component.id}
            value={option}
            checked={selected.includes(option)}
            disabled={disabled}
            readOnly={readOnly}
            aria-readonly={readOnly || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={descriptionIds}
            onChange={(event) => toggle(option, event.target.checked)}
          />
        ))}
      </div>
    </QuestionField>
  );
}
