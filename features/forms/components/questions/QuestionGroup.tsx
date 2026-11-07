"use client";

import type { ComponentType } from "react";
import { FORM_RENDERERS } from "@/features/forms/components/renderers";
import QuestionField from "@/features/forms/components/questions/QuestionField";
import {
  describedBy,
  fieldId,
  type GroupFieldEntry,
  type QuestionProps,
} from "@/features/forms/components/types";
import type { FormComponentOfType } from "@/features/forms/lib/schema";
import { FormComponentType } from "@/features/forms/schema";
import ThemedButton from "@/components/theme/ThemedButton";

export default function QuestionGroup({
  component,
  value,
  error,
  errors = {},
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<FormComponentType.QuestionGroup>>) {
  const { questions, repeatable, minEntries, maxEntries, addLabel } =
    component.config;
  const minimum = repeatable
    ? Math.max(component.required ? 1 : 0, minEntries ?? 0)
    : 1;
  const entries: GroupFieldEntry[] =
    Array.isArray(value) && value.every((entry) => typeof entry === "object")
      ? (value as GroupFieldEntry[])
      : Array.from({ length: readOnly ? 0 : minimum }, () => ({}));

  return (
    <QuestionField component={component} group error={error}>
      <div
        id={fieldId(component.id)}
        tabIndex={-1}
        aria-describedby={describedBy(component, error)}
        className="@container flex min-w-0 flex-col gap-5 outline-none"
      >
        {entries.map((entry, index) => (
          <fieldset
            key={index}
            className="min-w-0 rounded-control border border-grey-stroke-weak p-5"
          >
            <legend className="px-2 text-paragraph-1 font-semibold text-page-text">
              {component.label} {index + 1}
            </legend>
            <div className="grid min-w-0 grid-cols-1 gap-6 @md:grid-cols-2">
              {questions.map((question, position) => {
                const id = `${component.id}.${index}.${question.id}`;
                const Renderer = FORM_RENDERERS[
                  question.type
                ] as ComponentType<QuestionProps>;
                return (
                  <Renderer
                    key={question.id}
                    component={{ ...question, id, helpText: null, position }}
                    value={entry[question.id]}
                    error={errors[id]}
                    disabled={disabled}
                    readOnly={readOnly}
                    onBlur={onBlur}
                    onChange={(cell) => {
                      if (readOnly || disabled) return;
                      const next = { ...entry };
                      if (cell === undefined) delete next[question.id];
                      else next[question.id] = cell as GroupFieldEntry[string];
                      onChange(
                        entries.map((previous, i) =>
                          i === index ? next : previous,
                        ),
                      );
                    }}
                  />
                );
              })}
            </div>
            {repeatable && !readOnly && (
              <ThemedButton
                type="button"
                variant="secondary"
                className="mt-4"
                disabled={disabled || entries.length <= minimum}
                onClick={() => onChange(entries.filter((_, i) => i !== index))}
              >
                Remove entry {index + 1}
              </ThemedButton>
            )}
          </fieldset>
        ))}
        {readOnly && entries.length === 0 && (
          <p className="text-paragraph-2 text-grey-text-weak">No entries</p>
        )}
        {repeatable && !readOnly && (
          <ThemedButton
            type="button"
            variant="secondary"
            className="self-start"
            disabled={disabled || entries.length >= (maxEntries ?? 20)}
            onClick={() => onChange([...entries, {}])}
          >
            {addLabel ?? "Add another"}
          </ThemedButton>
        )}
      </div>
    </QuestionField>
  );
}
