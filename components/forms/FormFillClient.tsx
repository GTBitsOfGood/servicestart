"use client";

import { useEffect, useRef, useState } from "react";
import DynamicForm, {
  type DynamicFormSubmitResult,
} from "@/components/forms/DynamicForm";
import FormMessage from "@/components/forms/FormMessage";
import api from "@/lib/api";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";

type FormFillClientProps = {
  definition: Pick<FormDefinition, "formId" | "components">;
};

/** Submits a form through the API and shows its confirmation message. */
export default function FormFillClient({ definition }: FormFillClientProps) {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmation === null) return;
    window.scrollTo({ top: 0 });
    confirmationRef.current?.focus();
  }, [confirmation]);

  async function submit(
    answers: Record<string, FormAnswerValue>,
  ): Promise<DynamicFormSubmitResult> {
    try {
      const res = await api.forms[":formId"].submissions.$post({
        param: { formId: definition.formId },
        json: { answers },
      });
      if (res.status === 201) {
        setConfirmation((await res.json()).confirmationMessage);
        return { ok: true };
      }
      if (res.status === 400) {
        const { error, fieldErrors } = await res.json();
        return { ok: false, error, fieldErrors };
      }
      if (res.status === 409) {
        return { ok: false, error: (await res.json()).error };
      }
      // Auth and availability errors come back as plain text.
      const message = await res.text().catch(() => "");
      return {
        ok: false,
        error: message || "Couldn't submit the form. Try again.",
      };
    } catch {
      return {
        ok: false,
        error: "Couldn't submit the form. Check your connection and try again.",
      };
    }
  }

  if (confirmation !== null) {
    return (
      <div ref={confirmationRef} tabIndex={-1} className="outline-none">
        <FormMessage title="Response submitted" role="status">
          {confirmation}
        </FormMessage>
      </div>
    );
  }

  return <DynamicForm definition={definition} onSubmit={submit} />;
}
