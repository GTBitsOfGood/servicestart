import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import db from "@/lib/db";
import { formComponents, forms, FormStatus } from "@/lib/schema";
import type { FormComponent } from "@/lib/forms/schema";
import { FormError, SaveQuestionsSchema } from "@/lib/forms/management";
import { FormService, type Transaction } from "@/lib/services/FormService";

const questionColumns = {
  id: formComponents.id,
  type: formComponents.type,
  label: formComponents.label,
  helpText: formComponents.helpText,
  required: formComponents.required,
  position: formComponents.position,
  config: formComponents.config,
};

async function questionsOf(
  tx: Transaction | typeof db,
  organizationId: string,
  formUuid: string,
) {
  const rows = await tx
    .select(questionColumns)
    .from(formComponents)
    .where(
      and(
        eq(formComponents.formId, formUuid),
        eq(formComponents.organizationId, organizationId),
        isNull(formComponents.archivedAt),
      ),
    )
    .orderBy(asc(formComponents.position));
  return rows as FormComponent[];
}

/** A form's title, status, and questions in order, for the builder. */
async function get(organizationId: string, formId: string) {
  const form = await FormService.get(organizationId, formId);
  return {
    formId: form.formId,
    title: form.title,
    status: form.status,
    questions: await questionsOf(db, organizationId, form.id),
  };
}

/**
 * Replaces a draft form's questions with `input`, in order: questions that
 * keep their ID are updated, new ones inserted, and missing ones deleted.
 */
async function save(
  organizationId: string,
  formId: string,
  input: z.input<typeof SaveQuestionsSchema>,
) {
  const { questions } = SaveQuestionsSchema.parse(input);
  return db.transaction(async (tx) => {
    const form = await FormService.lockedForm(tx, organizationId, formId);
    if (form.status !== FormStatus.Draft)
      throw new FormError(
        "conflict",
        "Questions can't change once a form is published",
      );

    const existing = new Set(
      (await questionsOf(tx, organizationId, form.id)).map(({ id }) => id),
    );
    // Also rejects IDs from other forms and organizations.
    if (questions.some(({ id }) => id && !existing.has(id)))
      throw new FormError(
        "invalid",
        "A question doesn't belong to this form",
        "questions",
      );

    const kept = new Set(questions.flatMap(({ id }) => (id ? [id] : [])));
    const removed = [...existing].filter((id) => !kept.has(id));
    if (removed.length > 0)
      await tx
        .delete(formComponents)
        .where(
          and(
            eq(formComponents.formId, form.id),
            eq(formComponents.organizationId, organizationId),
            inArray(formComponents.id, removed),
          ),
        );

    const inserts = [];
    for (const [position, { id, ...question }] of questions.entries()) {
      const values = { ...question, position };
      if (id)
        await tx
          .update(formComponents)
          .set(values)
          .where(
            and(
              eq(formComponents.id, id),
              eq(formComponents.formId, form.id),
              eq(formComponents.organizationId, organizationId),
            ),
          );
      else inserts.push({ ...values, formId: form.id, organizationId });
    }
    if (inserts.length > 0) await tx.insert(formComponents).values(inserts);

    await tx
      .update(forms)
      .set({ updatedAt: new Date() })
      .where(eq(forms.id, form.id));

    return {
      formId: form.formId,
      title: form.title,
      status: form.status,
      questions: await questionsOf(tx, organizationId, form.id),
    };
  });
}

export const FormQuestionService = {
  get,
  save,
};
