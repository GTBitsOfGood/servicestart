import type { z } from "zod";
import {
  FormQuestionInputSchema,
  type FormComponent,
  type FormQuestionInput,
} from "@/lib/forms/schema";
import { FormComponentType } from "@/lib/schema";

/** A question while it's being edited in the builder. */
export type DraftQuestion = {
  /** Stable while editing, for React keys and element IDs. */
  key: string;
  /** The saved question's ID; missing until a new question is saved. */
  id?: string;
  type: FormComponentType;
  label: string;
  /** A section header's description. Blank means none. */
  helpText: string;
  required: boolean;
  // Checked against the type's schema by validateQuestion.
  config: Record<string, unknown>;
};

/** Field errors keyed by path, e.g. "label" or "config.options.2". */
export type QuestionErrors = Record<string, string>;

let lastKey = 0;
// crypto.randomUUID needs a secure context, which local tenants aren't.
export function newKey() {
  lastKey += 1;
  return `question-${lastKey}`;
}

export function toDraft(question: FormComponent): DraftQuestion {
  return {
    key: newKey(),
    id: question.id,
    type: question.type,
    label: question.label,
    helpText: question.helpText ?? "",
    required: question.required,
    config: question.config,
  };
}

export function toInput(draft: DraftQuestion): FormQuestionInput {
  return {
    id: draft.id,
    type: draft.type,
    label: draft.label,
    helpText: draft.helpText.trim() || null,
    // Section headers take no answer.
    required:
      draft.type === FormComponentType.SectionHeader ? false : draft.required,
    config: draft.config,
  } as FormQuestionInput;
}

/** What gets saved, for telling whether anything changed. */
export function snapshot(drafts: DraftQuestion[]) {
  return JSON.stringify(drafts.map(toInput));
}

// Plain-language versions of zod's generic messages. The contract's own
// messages, like "Each option must be different", pass through unchanged.
function message(issue: z.core.$ZodIssue) {
  if (issue.code === "invalid_type")
    return issue.expected === "int" ? "Enter a whole number" : "Enter a number";
  if (issue.code === "too_small" && issue.origin === "number")
    return issue.inclusive
      ? `Enter ${issue.minimum} or more`
      : `Enter a number greater than ${issue.minimum}`;
  return issue.message;
}

/** The question's validation errors, using the forms contract's messages. */
export function validateQuestion(draft: DraftQuestion): QuestionErrors {
  const result = FormQuestionInputSchema.safeParse(toInput(draft));
  if (result.success) return {};
  const errors: QuestionErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    errors[path] ??= message(issue);
  }
  return errors;
}

/** The element ID for a question's field, e.g. its label or an option. */
export function questionFieldId(key: string, path: string) {
  return `${key}-${path.replaceAll(".", "-")}`;
}

export function questionErrorId(key: string, path: string) {
  return `${questionFieldId(key, path)}-error`;
}
