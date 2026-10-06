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
import BogButton from "@/components/bog/BogButton/BogButton";
import { DynamicFormContext } from "@/components/forms/DynamicFormContext";
import { FORM_RENDERERS } from "@/components/forms/renderers";
import {
  fieldId,
  type FieldValue,
  type QuestionProps,
} from "@/components/forms/types";
import { uploadFormImage } from "@/components/forms/uploadFormImage";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";
import {
  buildSubmissionSchema,
  getAnswerErrors,
  parseNumberInput,
} from "@/lib/forms/submission";
import { FormComponentType } from "@/lib/schema";

export type DynamicFormSubmitResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type DynamicFormProps = {
  definition: Pick<FormDefinition, "formId" | "components">;
  /** Shows the questions without a submit button or uploads. */
  preview?: boolean;
  onSubmit?: (
    answers: Record<string, FormAnswerValue>,
  ) => Promise<DynamicFormSubmitResult>;
  uploadImage?: typeof uploadFormImage;
};

const FORM_ERROR_ID = "form-error";

/** Renders a form's questions in order and validates them as they're filled. */
export default function DynamicForm({
  definition,
  preview = false,
  onSubmit,
  uploadImage = uploadFormImage,
}: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, FieldValue>>({});
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

  function showFieldError(id: string, current: Record<string, FieldValue>) {
    const error = validate(current).errors[id];
    setErrors((previous) => {
      const next = { ...previous };
      if (error) next[id] = error;
      else delete next[id];
      return next;
    });
  }

  function handleChange(id: string, value: FieldValue | undefined) {
    dirtyIds.current.add(id);
    const next = { ...values };
    if (value === undefined) delete next[id];
    else next[id] = value;
    setValues(next);
    if (errors[id]) showFieldError(id, next);
  }

  function handleBlur(id: string) {
    if (dirtyIds.current.has(id) || errors[id]) showFieldError(id, values);
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
    focusTarget.current = first ? fieldId(first.id) : FORM_ERROR_ID;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview || !onSubmit || submittingRef.current) return;

    const { answers, errors: fieldErrors } = validate(values);
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
    () => ({ formId: definition.formId, preview, uploadImage, setUploading }),
    [definition.formId, preview, uploadImage, setUploading],
  );

  return (
    <DynamicFormContext.Provider value={context}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-8">
        <p className="text-paragraph-2 text-grey-text-weak">
          Questions marked <span aria-hidden="true">*</span>
          <span className="sr-only">with an asterisk</span> are required.
        </p>
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
              disabled={submitting}
              onChange={(value) => handleChange(component.id, value)}
              onBlur={() => handleBlur(component.id)}
            />
          );
        })}
        {!preview && (
          <BogButton
            type="submit"
            disabled={submitting || uploadingIds.length > 0}
            aria-busy={submitting}
            className="self-start"
          >
            {submitting ? "Submitting…" : "Submit"}
          </BogButton>
        )}
      </form>
    </DynamicFormContext.Provider>
  );
}
