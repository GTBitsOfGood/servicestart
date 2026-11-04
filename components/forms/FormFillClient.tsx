"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import DynamicForm, {
  type DynamicFormSubmitResult,
} from "@/components/forms/DynamicForm";
import FormMessage from "@/components/forms/FormMessage";
import api from "@/lib/api";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";

type FormFillClientProps = {
  definition: Pick<FormDefinition, "formId" | "components">;
} & (
  | { mode?: "submit" }
  | {
      mode: "edit";
      /** The member's saved answers to start from. */
      initialValues: Record<string, FormAnswerValue>;
      /** Where saved images load from, without a trailing slash. */
      uploadsPath: string;
    }
);

type Answers = Record<string, FormAnswerValue>;

const SUBMIT_FAILED = "Couldn't submit the form.";
const SAVE_FAILED = "Couldn't save your changes.";

/** Submits a new response, or saves changes to an existing one. */
export default function FormFillClient(props: FormFillClientProps) {
  const { definition } = props;
  const isEdit = props.mode === "edit";
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmation === null) return;
    window.scrollTo({ top: 0 });
    confirmationRef.current?.focus();
  }, [confirmation]);

  const uploadsPath = props.mode === "edit" ? props.uploadsPath : null;
  const imageSrc = useCallback(
    (uploadId: string) =>
      uploadsPath === null
        ? null
        : `${uploadsPath}/${encodeURIComponent(uploadId)}`,
    [uploadsPath],
  );

  async function submit(answers: Answers): Promise<DynamicFormSubmitResult> {
    const failed = isEdit ? SAVE_FAILED : SUBMIT_FAILED;
    try {
      const res = isEdit
        ? await api.forms[":formId"].submissions.mine.$put({
            param: { formId: definition.formId },
            json: { answers },
          })
        : await api.forms[":formId"].submissions.$post({
            param: { formId: definition.formId },
            json: { answers },
          });
      if (res.status === 201 && !isEdit) {
        const body = await res.json();
        if ("confirmationMessage" in body) {
          setConfirmation(body.confirmationMessage);
          return { ok: true };
        }
      }
      if (res.status === 200 && isEdit) {
        setConfirmation("Your response has been updated.");
        return { ok: true };
      }
      if (res.status === 400) {
        const { error, fieldErrors } = await res.json();
        return { ok: false, error, fieldErrors };
      }
      if (res.status === 404 || res.status === 409) {
        return { ok: false, error: (await res.json()).error };
      }
      // Auth and availability errors come back as plain text.
      const message = await res.text().catch(() => "");
      return { ok: false, error: message || `${failed} Try again.` };
    } catch {
      return {
        ok: false,
        error: `${failed} Check your connection and try again.`,
      };
    }
  }

  if (confirmation !== null) {
    return (
      <div ref={confirmationRef} tabIndex={-1} className="outline-none">
        <FormMessage
          title={isEdit ? "Changes saved" : "Response submitted"}
          role="status"
        >
          {confirmation}
          {isEdit && (
            <>
              {" "}
              <Link
                href="/"
                className="font-semibold text-brand-text underline"
              >
                Back to home
              </Link>
            </>
          )}
        </FormMessage>
      </div>
    );
  }

  return (
    <DynamicForm
      definition={definition}
      onSubmit={submit}
      {...(props.mode === "edit"
        ? {
            initialValues: props.initialValues,
            submitLabel: "Save changes",
            submittingLabel: "Saving…",
            imageSrc,
          }
        : {})}
    />
  );
}
