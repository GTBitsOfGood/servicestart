import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import db from "@/lib/db";
import {
  FormComponentType,
  FormStatus,
  formAnswers,
  formComponents,
  formSubmissions,
  formUploads,
  forms,
} from "@/lib/schema";
import type {
  FormAnswerValue,
  FormComponent,
  FormDefinition,
} from "@/lib/forms/schema";

export class DuplicateSubmissionError extends Error {
  constructor() {
    super("This user has already responded to the form");
    this.name = "DuplicateSubmissionError";
  }
}

/** An image answer's upload isn't one the submitter made to this form. */
export class InvalidUploadError extends Error {
  constructor(readonly componentId: string) {
    super("The image upload doesn't belong to this submission");
    this.name = "InvalidUploadError";
  }
}

/** A form and its non-archived components in order, in any status. */
async function getDefinition(
  organizationId: string,
  formId: string,
): Promise<FormDefinition | null> {
  const [form] = await db
    .select({
      id: forms.id,
      formId: forms.formId,
      title: forms.title,
      description: forms.description,
      status: forms.status,
      settings: forms.settings,
    })
    .from(forms)
    .where(
      and(eq(forms.organizationId, organizationId), eq(forms.formId, formId)),
    )
    .limit(1);
  if (!form) return null;

  const components = await db
    .select({
      id: formComponents.id,
      type: formComponents.type,
      label: formComponents.label,
      helpText: formComponents.helpText,
      required: formComponents.required,
      position: formComponents.position,
      config: formComponents.config,
    })
    .from(formComponents)
    .where(
      and(
        eq(formComponents.formId, form.id),
        eq(formComponents.organizationId, organizationId),
        isNull(formComponents.archivedAt),
      ),
    )
    .orderBy(asc(formComponents.position));

  return { ...form, components: components as FormComponent[] };
}

/**
 * A form's definition unless it's a draft. Closed forms are included so their
 * page can say they're closed.
 */
async function getPublishedDefinition(organizationId: string, formId: string) {
  const definition = await getDefinition(organizationId, formId);
  return definition?.status === FormStatus.Draft ? null : definition;
}

async function hasSubmitted(formId: string, userId: string) {
  const [submission] = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.formId, formId),
        eq(formSubmissions.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(submission);
}

/**
 * Saves a submission and its answers, which must already be validated with
 * buildSubmissionSchema. `userId` is null for a guest.
 */
async function submit({
  form,
  organizationId,
  userId,
  answers,
}: {
  form: Pick<FormDefinition, "id" | "settings" | "components">;
  organizationId: string;
  userId: string | null;
  answers: Record<string, FormAnswerValue>;
}) {
  return db.transaction(async (tx) => {
    if (userId && !form.settings.allowMultipleSubmissions) {
      // Locks the form so two concurrent submissions can't both pass.
      await tx
        .select({ id: forms.id })
        .from(forms)
        .where(eq(forms.id, form.id))
        .for("update");
      const [existing] = await tx
        .select({ id: formSubmissions.id })
        .from(formSubmissions)
        .where(
          and(
            eq(formSubmissions.formId, form.id),
            eq(formSubmissions.userId, userId),
          ),
        )
        .limit(1);
      if (existing) throw new DuplicateSubmissionError();
    }

    const imageAnswers = form.components.flatMap((component) => {
      const answer = answers[component.id];
      return component.type === FormComponentType.Image &&
        answer &&
        typeof answer === "object"
        ? [{ componentId: component.id, uploadId: answer.uploadId }]
        : [];
    });
    if (imageAnswers.length > 0) {
      const uploads = await tx
        .select({ id: formUploads.id })
        .from(formUploads)
        .where(
          and(
            inArray(
              formUploads.id,
              imageAnswers.map(({ uploadId }) => uploadId),
            ),
            eq(formUploads.formId, form.id),
            eq(formUploads.organizationId, organizationId),
            userId
              ? eq(formUploads.uploadedBy, userId)
              : isNull(formUploads.uploadedBy),
          ),
        );
      const validIds = new Set(uploads.map(({ id }) => id));
      const invalid = imageAnswers.find(
        ({ uploadId }) => !validIds.has(uploadId),
      );
      if (invalid) throw new InvalidUploadError(invalid.componentId);
    }

    const [submission] = await tx
      .insert(formSubmissions)
      .values({ formId: form.id, organizationId, userId })
      .returning({ id: formSubmissions.id });

    const rows = Object.entries(answers).map(([componentId, value]) => ({
      formId: form.id,
      submissionId: submission.id,
      componentId,
      value,
    }));
    if (rows.length > 0) await tx.insert(formAnswers).values(rows);

    return submission.id;
  });
}

/** Records a file already in storage. `uploadedBy` is null for a guest. */
async function createUpload(upload: {
  organizationId: string;
  formId: string;
  uploadedBy: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const [row] = await db
    .insert(formUploads)
    .values(upload)
    .returning({ id: formUploads.id });
  return row.id;
}

export const FormSubmissionService = {
  getDefinition,
  getPublishedDefinition,
  hasSubmitted,
  submit,
  createUpload,
};
