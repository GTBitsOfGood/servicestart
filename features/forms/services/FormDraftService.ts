import { and, eq } from "drizzle-orm";
import db from "@/core/db";
import { formResponseDrafts, forms } from "@/core/db/schema";
import type { FormAnswerValue } from "@/features/forms/lib/schema";

export type FormDraft = {
  id: string;
  answers: Record<string, FormAnswerValue>;
  updatedAt: Date;
};

const draftColumns = {
  id: formResponseDrafts.id,
  answers: formResponseDrafts.answers,
  updatedAt: formResponseDrafts.updatedAt,
};

/** Resolves a form's UUID without allowing a form from another org through. */
async function getFormUuid(organizationId: string, formId: string) {
  const [form] = await db
    .select({ id: forms.id })
    .from(forms)
    .where(
      and(eq(forms.organizationId, organizationId), eq(forms.formId, formId)),
    )
    .limit(1);
  return form?.id ?? null;
}

/** Gets this member's draft, or null when the form or draft doesn't exist. */
async function get(
  organizationId: string,
  formId: string,
  userId: string,
): Promise<FormDraft | null> {
  const formUuid = await getFormUuid(organizationId, formId);
  if (!formUuid) return null;

  const [draft] = await db
    .select(draftColumns)
    .from(formResponseDrafts)
    .where(
      and(
        eq(formResponseDrafts.organizationId, organizationId),
        eq(formResponseDrafts.formId, formUuid),
        eq(formResponseDrafts.userId, userId),
      ),
    )
    .limit(1);
  return draft ?? null;
}

/**
 * Creates or replaces this member's draft. Returns null when the form isn't in
 * the organization. Validation and form availability are enforced by the API
 * route before this service is called.
 */
async function save({
  organizationId,
  formId,
  userId,
  answers,
}: {
  organizationId: string;
  formId: string;
  userId: string;
  answers: Record<string, FormAnswerValue>;
}): Promise<FormDraft | null> {
  const formUuid = await getFormUuid(organizationId, formId);
  if (!formUuid) return null;

  const [draft] = await db
    .insert(formResponseDrafts)
    .values({ organizationId, formId: formUuid, userId, answers })
    .onConflictDoUpdate({
      target: [formResponseDrafts.formId, formResponseDrafts.userId],
      set: { answers, updatedAt: new Date() },
    })
    .returning(draftColumns);
  return draft;
}

/** Deletes this member's draft and reports whether one existed. */
async function deleteDraft(
  organizationId: string,
  formId: string,
  userId: string,
): Promise<boolean> {
  const formUuid = await getFormUuid(organizationId, formId);
  if (!formUuid) return false;

  const deleted = await db
    .delete(formResponseDrafts)
    .where(
      and(
        eq(formResponseDrafts.organizationId, organizationId),
        eq(formResponseDrafts.formId, formUuid),
        eq(formResponseDrafts.userId, userId),
      ),
    )
    .returning({ id: formResponseDrafts.id });
  return deleted.length > 0;
}

export const FormDraftService = {
  get,
  save,
  delete: deleteDraft,
};
