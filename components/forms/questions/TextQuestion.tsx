"use client";

import QuestionField from "@/components/forms/questions/QuestionField";
import { textControlClassName } from "@/components/forms/questions/textControlClassName";
import {
  describedBy,
  fieldId,
  type QuestionProps,
} from "@/components/forms/types";
import type { FormComponentOfType } from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

type TextType =
  | FormComponentType.ShortText
  | FormComponentType.Email
  | FormComponentType.Phone
  | FormComponentType.Number;

// Numbers stay text so a typed value isn't reshaped; the keypad comes from
// inputMode.
const INPUT_TYPES = {
  [FormComponentType.ShortText]: "text",
  [FormComponentType.Email]: "email",
  [FormComponentType.Phone]: "tel",
  [FormComponentType.Number]: "text",
} as const satisfies Record<TextType, string>;

/**
 * Short text, email, phone, and number questions. A plain input rather than
 * BogTextInput, which takes no id: the label has to point at the input in the
 * server-rendered markup, or Firefox never associates them.
 */
export default function TextQuestion({
  component,
  value,
  error,
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<TextType>>) {
  const inputMode =
    component.type === FormComponentType.Number
      ? component.config.integer
        ? "numeric"
        : "decimal"
      : undefined;

  return (
    <QuestionField component={component} error={error}>
      <input
        id={fieldId(component.id)}
        name={component.id}
        type={INPUT_TYPES[component.type]}
        inputMode={inputMode}
        required={component.required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(component, error)}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={textControlClassName(Boolean(error))}
      />
    </QuestionField>
  );
}
