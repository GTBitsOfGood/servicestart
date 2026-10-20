"use client";

import QuestionField from "@/components/forms/questions/QuestionField";
import {
  describedBy,
  fieldId,
  type QuestionProps,
} from "@/components/forms/types";
import { countWords } from "@/lib/forms/submission";
import type { FormComponentOfType } from "@/lib/forms/schema";
import type { FormComponentType } from "@/lib/schema";
import { cn } from "@/lib/utils";

function wordRange(minWords?: number, maxWords?: number) {
  if (minWords !== undefined && maxWords !== undefined) {
    return `${minWords}–${maxWords} words`;
  }
  if (minWords !== undefined) return `at least ${minWords} words`;
  if (maxWords !== undefined) return `up to ${maxWords} words`;
  return null;
}

/** A textarea with a live word count. */
export default function LongTextQuestion({
  component,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<FormComponentType.LongText>>) {
  const text = typeof value === "string" ? value : "";
  const words = countWords(text);
  const range = wordRange(component.config.minWords, component.config.maxWords);
  const countId = `${fieldId(component.id)}-count`;

  return (
    <QuestionField component={component} error={error}>
      <textarea
        id={fieldId(component.id)}
        name={component.id}
        rows={6}
        required={component.required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(component, error, countId)}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={cn(
          "w-full resize-y rounded-control border bg-solid-bg-sunken px-4 py-3 text-paragraph-2 text-page-text focus:border-brand-stroke-strong focus:outline-none disabled:cursor-not-allowed disabled:opacity-85",
          error
            ? "border-status-red-stroke-strong"
            : "border-grey-stroke-weak hover:border-brand-stroke-strong",
        )}
      />
      <p id={countId} className="text-paragraph-2 text-grey-text-weak">
        {words === 1 ? "1 word" : `${words} words`}
        {range && ` (${range})`}
      </p>
    </QuestionField>
  );
}
