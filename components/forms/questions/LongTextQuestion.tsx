"use client";

import QuestionField from "@/components/forms/questions/QuestionField";
import { textControlClassName } from "@/components/forms/questions/textControlClassName";
import {
  describedBy,
  fieldId,
  type QuestionProps,
} from "@/components/forms/types";
import { countWords } from "@/lib/forms/submission";
import type { FormComponentOfType } from "@/lib/forms/schema";
import type { FormComponentType } from "@/lib/schema";

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
  readOnly,
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
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(
          component,
          error,
          ...(readOnly ? [] : [countId]),
        )}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={textControlClassName(
          Boolean(error),
          "resize-y",
          // Shows the whole answer instead of scrolling inside the box.
          readOnly && "field-sizing-content resize-none",
        )}
      />
      {!readOnly && (
        <p id={countId} className="text-paragraph-2 text-grey-text-weak">
          {words === 1 ? "1 word" : `${words} words`}
          {range && ` (${range})`}
        </p>
      )}
    </QuestionField>
  );
}
