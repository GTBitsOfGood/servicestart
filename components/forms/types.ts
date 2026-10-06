import type { FormComponentType } from "@/lib/schema";
import type { FormAnswerValueFor, FormComponent } from "@/lib/forms/schema";

/** What a question holds while it's being filled out. Numbers stay text. */
export type FieldValue = string | FormAnswerValueFor<FormComponentType.Image>;

export type QuestionProps<C extends FormComponent = FormComponent> = {
  component: C;
  value: FieldValue | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: FieldValue | undefined) => void;
  onBlur: () => void;
};

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
