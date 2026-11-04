import type { FocusEvent } from "react";
import type { FormComponentType } from "@/lib/schema";
import type {
  FormAnswerValue,
  FormAnswerValueFor,
  FormComponent,
} from "@/lib/forms/schema";

/** What a question holds while it's being filled out. Numbers stay text. */
export type FieldValue =
  | string
  | string[]
  | boolean
  | FormAnswerValueFor<FormComponentType.Image>;

export type QuestionProps<C extends FormComponent = FormComponent> = {
  component: C;
  value: FieldValue | undefined;
  error?: string;
  disabled: boolean;
  /**
   * Shows the answer without letting it change, e.g. on a submitted response.
   * Keep the control focusable and readable rather than greyed out.
   */
  readOnly: boolean;
  onChange: (value: FieldValue | undefined) => void;
  onBlur: () => void;
};

/** Saved answers as field values, e.g. to prefill a form. */
export function toFieldValues(
  answers: Record<string, FormAnswerValue>,
): Record<string, FieldValue> {
  return Object.fromEntries(
    Object.entries(answers).map(([id, value]) => [
      id,
      typeof value === "number" ? String(value) : value,
    ]),
  );
}

export function fieldId(componentId: string) {
  return `question-${componentId}`;
}

export function helpTextId(componentId: string) {
  return `question-${componentId}-help`;
}

export function errorId(componentId: string) {
  return `question-${componentId}-error`;
}

/** IDs for a question's aria-describedby: its help text, error, and extras. */
export function describedBy(
  component: { id: string; helpText: string | null },
  error: string | undefined,
  ...extra: string[]
) {
  const ids = [
    component.helpText ? helpTextId(component.id) : null,
    error ? errorId(component.id) : null,
    ...extra,
  ].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** Calls `onBlur` once focus leaves a group of controls, not between them. */
export function groupBlur(onBlur: () => void) {
  return (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null))
      onBlur();
  };
}
