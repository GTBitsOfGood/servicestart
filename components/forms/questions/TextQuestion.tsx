"use client";

import { useEffect, useRef } from "react";
import QuestionField from "@/components/forms/questions/QuestionField";
import {
  describedBy,
  fieldId,
  type QuestionProps,
} from "@/components/forms/types";
import ThemedTextInput from "@/components/theme/ThemedTextInput";
import type { FormComponentOfType } from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

type TextType =
  | FormComponentType.ShortText
  | FormComponentType.Email
  | FormComponentType.Phone
  | FormComponentType.Number;

// BogTextInput has no number type, so numbers use text with a numeric keypad.
const INPUT_TYPES = {
  [FormComponentType.ShortText]: "text",
  [FormComponentType.Email]: "email",
  [FormComponentType.Phone]: "tel",
  [FormComponentType.Number]: "text",
} as const satisfies Record<TextType, string>;

function setAttribute(element: Element, name: string, value?: string) {
  if (value === undefined) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/** Short text, email, phone, and number questions. */
export default function TextQuestion({
  component,
  value,
  error,
  disabled,
  readOnly,
  onChange,
  onBlur,
}: QuestionProps<FormComponentOfType<TextType>>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionIds = describedBy(component, error);
  const inputMode =
    component.type === FormComponentType.Number
      ? component.config.integer
        ? "numeric"
        : "decimal"
      : undefined;

  // BogTextInput doesn't take an id, ARIA attributes, inputMode, or readOnly.
  useEffect(() => {
    const input = containerRef.current?.querySelector("input");
    if (!input) return;
    input.id = fieldId(component.id);
    setAttribute(input, "aria-describedby", descriptionIds);
    setAttribute(input, "aria-invalid", error ? "true" : undefined);
    setAttribute(input, "inputmode", inputMode);
    setAttribute(input, "readonly", readOnly ? "" : undefined);
  }, [component.id, descriptionIds, error, inputMode, readOnly]);

  return (
    <QuestionField component={component} error={error}>
      <div ref={containerRef} onBlur={onBlur}>
        <ThemedTextInput
          name={component.id}
          type={INPUT_TYPES[component.type]}
          placeholder=""
          required={component.required}
          disabled={disabled}
          error={Boolean(error)}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className="text-page-text"
        />
      </div>
    </QuestionField>
  );
}
