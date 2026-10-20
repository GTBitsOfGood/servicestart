"use client";

import { useCallback } from "react";
import DynamicForm from "@/components/forms/DynamicForm";
import type { FormAnswerValue, FormDefinition } from "@/lib/forms/schema";

type FormResponseViewProps = {
  definition: Pick<FormDefinition, "formId" | "components">;
  answers: Record<string, FormAnswerValue>;
  /**
   * Where uploaded images load from, without a trailing slash: the member's
   * own (`/api/forms/<formId>/my-uploads`) or an admin's
   * (`/api/forms/<formId>/uploads`).
   */
  uploadsPath: string;
};

/** A submitted response, read-only. */
export default function FormResponseView({
  definition,
  answers,
  uploadsPath,
}: FormResponseViewProps) {
  const imageSrc = useCallback(
    (uploadId: string) => `${uploadsPath}/${encodeURIComponent(uploadId)}`,
    [uploadsPath],
  );
  return (
    <DynamicForm
      definition={definition}
      initialValues={answers}
      imageSrc={imageSrc}
      readOnly
    />
  );
}
