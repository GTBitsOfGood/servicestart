"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
} from "react";
import BogBanner from "@/components/bog/BogBanner/BogBanner";
import { DynamicFormContext } from "@/features/forms/components/DynamicFormContext";
import { FORM_RENDERERS } from "@/features/forms/components/renderers";
import {
  fieldId,
  toFieldValues,
  type FieldValue,
  type GroupFieldEntry,
  type QuestionProps,
} from "@/features/forms/components/types";
import ThemedButton from "@/components/theme/ThemedButton";
import { uploadFormImage } from "@/features/forms/components/uploadFormImage";
import type {
  FormAnswerValue,
  FormDefinition,
  GroupEntryValue,
} from "@/features/forms/lib/schema";
import {
  buildSubmissionSchema,
  getAnswerErrors,
  parseNumberInput,
} from "@/features/forms/lib/submission";
import { FormComponentType } from "@/features/forms/schema";
import { useHydrated } from "@/core/utils/hooks/useHydrated";

export type DynamicFormSubmitResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type DynamicFormProps = {
  definition: Pick<FormDefinition, "formId" | "components">;
  /** Shows the questions without a submit button or uploads. */
  preview?: boolean;
  /** Saved answers to start from, e.g. when editing a response. */
  initialValues?: Record<string, FormAnswerValue>;
  /**
   * Shows `initialValues` as a finished response: nothing can change and
   * there's no submit button.
   */
  readOnly?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  onSubmit?: (
    answers: Record<string, FormAnswerValue>,
  ) => Promise<DynamicFormSubmitResult>;
  /** Reports loosely typed answers after each user change, for draft saving. */
  onAnswersChange?: (answers: Record<string, FormAnswerValue>) => void;
  /** Temporarily prevents changes, such as while a draft is being discarded. */
  disabled?: boolean;
  uploadImage?: typeof uploadFormImage;
  /** Where an already-uploaded image loads from; without it, none is shown. */
  imageSrc?: (uploadId: string) => string | null;
};

const noImageSrc = () => null;

const FORM_ERROR_ID = "form-error";

function isBlankGroupEntry(entry: unknown) {
  return (
    typeof entry === "object" &&
    entry !== null &&
    !Array.isArray(entry) &&
    Object.values(entry).every(
      (value) =>
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0),
    )
  );
}

/**
 * A number as typed, or undefined while it's blank or not yet a number. A
 * number answer must be a number, so a draft leaves those out.
 */
function draftNumber(text: string) {
  const parsed = parseNumberInput(text);
  return parsed === undefined || Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * The answers so far, for a draft (#338): numbers parsed, including inside a
 * question group's entries, and blank or half-typed numbers left out. Every
 * other answer is saved as it is, even if it isn't valid yet.
 */
function toDraftAnswers(
  components: FormDefinition["components"],
  values: Record<string, FieldValue>,
): Record<string, FormAnswerValue> {
  const answers: Record<string, FormAnswerValue> = {};
  for (const component of components) {
    const value = values[component.id];
    if (value === undefined) continue;
    if (component.type === FormComponentType.Number) {
      const parsed = typeof value === "string" ? draftNumber(value) : undefined;
      if (parsed !== undefined) answers[component.id] = parsed;
    } else if (component.type === FormComponentType.QuestionGroup) {
      if (!Array.isArray(value)) continue;
      const numberIds = new Set(
        component.config.questions
          .filter(({ type }) => type === FormComponentType.Number)
          .map(({ id }) => id),
      );
      // Blank entries stay, so the member gets back as many as they had.
      answers[component.id] = (value as GroupFieldEntry[]).map((entry) => {
        const cells: GroupEntryValue = {};
        for (const [id, cell] of Object.entries(entry)) {
          if (cell === undefined) continue;
          if (numberIds.has(id) && typeof cell === "string") {
            const parsed = draftNumber(cell);
            if (parsed !== undefined) cells[id] = parsed;
          } else {
            cells[id] = cell;
          }
        }
        return cells;
      });
    } else {
      answers[component.id] = value as FormAnswerValue;
    }
  }
  return answers;
}

/** Renders a form's questions in order and validates them as they're filled. */
export default function DynamicForm({
  definition,
  preview = false,
  initialValues,
  readOnly = false,
  submitLabel = "Submit",
  submittingLabel = "Submitting…",
  onSubmit,
  onAnswersChange,
  disabled = false,
  uploadImage = uploadFormImage,
  imageSrc = noImageSrc,
}: DynamicFormProps) {
  const hydrated = useHydrated();
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    toFieldValues(initialValues ?? {}),
  );
  // The latest answers, for callbacks that finish later, like an upload's.
  const valuesRef = useRef(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingIds, setUploadingIds] = useState<string[]>([]);
  const dirtyIds = useRef(new Set<string>());
  const submittingRef = useRef(false);
  const focusTarget = useRef<string | null>(null);

  const schema = useMemo(() => buildSubmissionSchema(definition), [definition]);

  const validate = useCallback(
    (current: Record<string, FieldValue>) => {
      const answers: Record<string, unknown> = {};
      for (const component of definition.components) {
        const value = current[component.id];
        if (component.type === FormComponentType.QuestionGroup) {
          const entries = Array.isArray(value)
            ? value
            : Array.from(
                {
                  length: component.config.repeatable
                    ? Math.max(
                        component.required ? 1 : 0,
                        component.config.minEntries ?? 0,
                      )
                    : 1,
                },
                () => ({}),
              );
          const groupAnswers = entries.map((entry) =>
            typeof entry === "object"
              ? Object.fromEntries(
                  Object.entries(entry).map(([id, cell]) => [
                    id,
                    component.config.questions.some(
                      (sub) =>
                        sub.id === id && sub.type === FormComponentType.Number,
                    ) && typeof cell === "string"
                      ? parseNumberInput(cell)
                      : cell,
                  ]),
                )
              : entry,
          );
          // A single entry is always displayed, but a blank optional group
          // stays unanswered until at least one child has a value.
          if (
            !component.required &&
            !component.config.repeatable &&
            groupAnswers.length <= 1 &&
            groupAnswers.every(isBlankGroupEntry)
          )
            continue;
          answers[component.id] = groupAnswers;
          continue;
        }
        answers[component.id] =
          component.type === FormComponentType.Number &&
          typeof value === "string"
            ? parseNumberInput(value)
            : value;
      }
      const result = schema.safeParse(answers);
      return result.success
        ? { answers: result.data, errors: {} as Record<string, string> }
        : { answers: null, errors: getAnswerErrors(result.error) };
    },
    [definition, schema],
  );

  // Moves focus after a failed submit, once the errors have rendered.
  useEffect(() => {
    if (!focusTarget.current) return;
    document.getElementById(focusTarget.current)?.focus();
    focusTarget.current = null;
  }, [errors, formError]);

  function showFieldError(
    id: string,
    current: Record<string, FieldValue>,
    { onlyIfShown = false } = {},
  ) {
    setErrors((previous) => {
      if (onlyIfShown && !previous[id]) return previous;
      const next = { ...previous };
      for (const key of Object.keys(next))
        if (key === id || key.startsWith(`${id}.`)) delete next[key];
      const fieldErrors = validate(current).errors;
      for (const key of Object.keys(fieldErrors))
        if (key === id || key.startsWith(`${id}.`))
          next[key] = fieldErrors[key];
      return next;
    });
  }

  function handleChange(id: string, value: FieldValue | undefined) {
    dirtyIds.current.add(id);
    const next = { ...valuesRef.current };
    if (value === undefined) delete next[id];
    else next[id] = value;
    valuesRef.current = next;
    setValues(next);
    onAnswersChange?.(toDraftAnswers(definition.components, next));
    // Clears a shown error once the answer is fixed.
    showFieldError(id, next, { onlyIfShown: true });
  }

  function handleBlur(id: string) {
    if (dirtyIds.current.has(id) || errors[id]) {
      showFieldError(id, valuesRef.current);
    }
  }

  const setUploading = useCallback((id: string, uploading: boolean) => {
    setUploadingIds((ids) =>
      uploading
        ? [...ids, id]
        : ids.filter((uploadingId) => uploadingId !== id),
    );
  }, []);

  function focusFirstError(fieldErrors: Record<string, string>) {
    const first = definition.components.find(({ id }) => fieldErrors[id]);
    const nested =
      first &&
      Object.keys(fieldErrors).find((key) => key.startsWith(`${first.id}.`));
    focusTarget.current = first ? fieldId(nested ?? first.id) : FORM_ERROR_ID;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || preview || readOnly || !onSubmit || submittingRef.current)
      return;

    const { answers, errors: fieldErrors } = validate(valuesRef.current);
    setErrors(fieldErrors);
    if (!answers) {
      setFormError(fieldErrors[""] ?? null);
      focusFirstError(fieldErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await onSubmit(answers);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        focusFirstError(result.fieldErrors ?? {});
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const context = useMemo(
    () => ({
      formId: definition.formId,
      preview,
      readOnly,
      uploadImage,
      imageSrc,
      setUploading,
    }),
    [definition.formId, preview, readOnly, uploadImage, imageSrc, setUploading],
  );

  return (
    <DynamicFormContext.Provider value={context}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-8">
        {!readOnly && (
          <p className="text-paragraph-2 text-grey-text-weak">
            Questions marked <span aria-hidden="true">*</span>
            <span className="sr-only">with an asterisk</span> are required.
          </p>
        )}
        {formError && (
          <div id={FORM_ERROR_ID} tabIndex={-1} className="outline-none">
            <BogBanner
              type="error"
              variant="surface"
              content={<span>{formError}</span>}
            />
          </div>
        )}
        {definition.components.map((component) => {
          // The registry is typed per type; this lookup loses the pairing.
          const Renderer = FORM_RENDERERS[
            component.type
          ] as ComponentType<QuestionProps>;
          return (
            <Renderer
              key={component.id}
              component={component}
              value={values[component.id]}
              error={errors[component.id]}
              errors={errors}
              disabled={!hydrated || submitting || disabled}
              readOnly={readOnly}
              onChange={(value) => handleChange(component.id, value)}
              onBlur={() => handleBlur(component.id)}
            />
          );
        })}
        {!preview && !readOnly && (
          <ThemedButton
            type="submit"
            disabled={
              !hydrated || disabled || submitting || uploadingIds.length > 0
            }
            aria-busy={submitting}
            className="self-start"
          >
            {submitting ? submittingLabel : submitLabel}
          </ThemedButton>
        )}
      </form>
    </DynamicFormContext.Provider>
  );
}
