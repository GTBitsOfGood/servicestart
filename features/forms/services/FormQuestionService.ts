import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import db from "@/core/db";
import {
  formComponents,
  forms,
  FormStatus,
  FormComponentType,
} from "@/core/db/schema";
import type { FormComponent } from "@/features/forms/lib/schema";
import {
  FormError,
  SaveQuestionsSchema,
} from "@/features/forms/lib/management";
import {
  FormService,
  type Transaction,
} from "@/features/forms/services/FormService";

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

    const savedQuestions = await questionsOf(tx, organizationId, form.id);
    const existing = new Set(savedQuestions.map(({ id }) => id));
    for (const question of questions) {
      if (question.type !== FormComponentType.QuestionGroup) continue;
      const saved = savedQuestions.find(({ id }) => id === question.id);
      const owned = new Set(
        saved?.type === FormComponentType.QuestionGroup
          ? saved.config.questions.map(({ id }) => id)
          : [],
      );
      if (question.config.questions.some(({ id }) => id && !owned.has(id)))
        throw new FormError(
          "invalid",
          "A sub-question doesn't belong to this group",
          "questions",
        );
    }
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
      const values = {
        ...question,
        position,
        config:
          question.type === FormComponentType.QuestionGroup
            ? {
                ...question.config,
                questions: question.config.questions.map((sub) => ({
                  ...sub,
                  id: sub.id ?? randomUUID(),
                })),
              }
            : question.config,
      };
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
