import { and, asc, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";
import db from "@/lib/db";
import {
  FormComponentType,
  FormStatus,
  type SubmissionReviewStatus,
  formAnswers,
  formComponents,
  formSubmissions,
  formUploads,
  forms,
  users,
} from "@/lib/schema";
import {
  isImageAnswer,
  type FormAnswerValue,
  type FormComponent,
  type FormDefinition,
} from "@/lib/forms/schema";
import { canEditSubmission, getFormAvailability } from "@/lib/forms/submission";

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

/** The submission can't be edited: it's been reviewed or the form isn't open. */
export class SubmissionNotEditableError extends Error {
  constructor() {
    super("This submission can no longer be edited");
    this.name = "SubmissionNotEditableError";
  }
}

/** A form and its non-archived components in order, in any status. */
async function getDefinition(
  organizationId: string,
  formId: string,
): Promise<FormDefinition | null> {
  return getDefinitionWhere(organizationId, eq(forms.formId, formId));
}

async function getDefinitionWhere(
  organizationId: string,
  where: SQL,
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
    .where(and(eq(forms.organizationId, organizationId), where))
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

/**
 * Whether the member's latest submission to the form can still be edited,
 * or null when they haven't responded.
 */
async function isMemberSubmissionEditable({
  form,
  organizationId,
  userId,
}: {
  form: Pick<FormDefinition, "id" | "status" | "settings">;
  organizationId: string;
  userId: string;
}) {
  const [latest] = await db
    .select({ reviewStatus: formSubmissions.reviewStatus })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.formId, form.id),
        eq(formSubmissions.organizationId, organizationId),
        eq(formSubmissions.userId, userId),
      ),
    )
    .orderBy(desc(formSubmissions.submittedAt), desc(formSubmissions.id))
    .limit(1);
  if (!latest) return null;
  return canEditSubmission({
    availability: getFormAvailability(form),
    reviewStatus: latest.reviewStatus,
  });
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Throws InvalidUploadError unless every image answer's upload was made by
 * `userId` (or a guest, when null) to this form in this org.
 */
async function assertOwnedUploads(
  tx: Transaction,
  {
    form,
    organizationId,
    userId,
    answers,
  }: {
    form: Pick<FormDefinition, "id" | "components">;
    organizationId: string;
    userId: string | null;
    answers: Record<string, FormAnswerValue>;
  },
) {
  const imageAnswers = form.components.flatMap((component) => {
    const answer = answers[component.id];
    return component.type === FormComponentType.Image && isImageAnswer(answer)
      ? [{ componentId: component.id, uploadId: answer.uploadId }]
      : [];
  });
  if (imageAnswers.length === 0) return;

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
  const invalid = imageAnswers.find(({ uploadId }) => !validIds.has(uploadId));
  if (invalid) throw new InvalidUploadError(invalid.componentId);
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

    await assertOwnedUploads(tx, { form, organizationId, userId, answers });

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

/**
 * Replaces a member's latest submission's answers with ones already validated
 * with buildSubmissionSchema, and stamps `updatedAt`. The review status is
 * left alone. Returns the submission ID, or null when they haven't responded.
 * Throws SubmissionNotEditableError unless canEditSubmission allows it.
 */
async function updateMemberSubmission({
  form,
  organizationId,
  userId,
  answers,
}: {
  form: Pick<FormDefinition, "id" | "status" | "settings" | "components">;
  organizationId: string;
  userId: string;
  answers: Record<string, FormAnswerValue>;
}) {
  return db.transaction(async (tx) => {
    // Lock the form before the submission, same order as submit, and decide
    // availability from this row. The form argument can be stale if an admin
    // closed it or moved the schedule after the caller loaded it.
    const [currentForm] = await tx
      .select({ status: forms.status, settings: forms.settings })
      .from(forms)
      .where(
        and(eq(forms.id, form.id), eq(forms.organizationId, organizationId)),
      )
      .for("update");
    if (!currentForm) return null;

    const [existing] = await tx
      .select({
        id: formSubmissions.id,
        reviewStatus: formSubmissions.reviewStatus,
      })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.formId, form.id),
          eq(formSubmissions.organizationId, organizationId),
          eq(formSubmissions.userId, userId),
        ),
      )
      .orderBy(desc(formSubmissions.submittedAt), desc(formSubmissions.id))
      .limit(1)
      .for("update");
    if (!existing) return null;
    const editable = canEditSubmission({
      availability: getFormAvailability(currentForm),
      reviewStatus: existing.reviewStatus,
    });
    if (!editable) throw new SubmissionNotEditableError();

    await assertOwnedUploads(tx, { form, organizationId, userId, answers });

    await tx
      .update(formSubmissions)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(formSubmissions.id, existing.id),
          eq(formSubmissions.organizationId, organizationId),
        ),
      );
    await tx
      .delete(formAnswers)
      .where(
        and(
          eq(formAnswers.submissionId, existing.id),
          eq(formAnswers.formId, form.id),
        ),
      );
    const rows = Object.entries(answers).map(([componentId, value]) => ({
      formId: form.id,
      submissionId: existing.id,
      componentId,
      value,
    }));
    if (rows.length > 0) await tx.insert(formAnswers).values(rows);

    return existing.id;
  });
}

/** Records an uploaded file. `uploadedBy` is null for a guest. */
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

async function deleteUpload(id: string, organizationId: string) {
  await db
    .delete(formUploads)
    .where(
      and(
        eq(formUploads.id, id),
        eq(formUploads.organizationId, organizationId),
      ),
    );
}

/** A submission with its form, answers, and submitter. */
export type SubmissionDetail = {
  submission: {
    id: string;
    userId: string | null;
    submittedAt: Date;
    /** Null until the submitter edits their answers. */
    updatedAt: Date | null;
    reviewStatus: SubmissionReviewStatus;
    reviewStatusUpdatedAt: Date | null;
  };
  /** Null for a guest, or once the submitter's account is deleted. */
  submitter: { id: string; name: string; email: string } | null;
  definition: FormDefinition;
  /** Keyed by component ID. Unanswered questions are left out. */
  answers: Record<string, FormAnswerValue>;
};

const submissionColumns = {
  id: formSubmissions.id,
  formId: formSubmissions.formId,
  userId: formSubmissions.userId,
  submittedAt: formSubmissions.submittedAt,
  updatedAt: formSubmissions.updatedAt,
  reviewStatus: formSubmissions.reviewStatus,
  reviewStatusUpdatedAt: formSubmissions.reviewStatusUpdatedAt,
  submitterName: users.name,
  submitterEmail: users.email,
};

async function toDetail(
  organizationId: string,
  row: {
    id: string;
    formId: string;
    userId: string | null;
    submittedAt: Date;
    updatedAt: Date | null;
    reviewStatus: SubmissionReviewStatus;
    reviewStatusUpdatedAt: Date | null;
    submitterName: string | null;
    submitterEmail: string | null;
  },
  definition?: FormDefinition,
): Promise<SubmissionDetail | null> {
  const form =
    definition ??
    (await getDefinitionWhere(organizationId, eq(forms.id, row.formId)));
  if (!form) return null;

  const answerRows = await db
    .select({ componentId: formAnswers.componentId, value: formAnswers.value })
    .from(formAnswers)
    .where(
      and(
        eq(formAnswers.submissionId, row.id),
        eq(formAnswers.formId, row.formId),
      ),
    );

  return {
    submission: {
      id: row.id,
      userId: row.userId,
      submittedAt: row.submittedAt,
      updatedAt: row.updatedAt,
      reviewStatus: row.reviewStatus,
      reviewStatusUpdatedAt: row.reviewStatusUpdatedAt,
    },
    submitter:
      row.userId && row.submitterName !== null && row.submitterEmail !== null
        ? { id: row.userId, name: row.submitterName, email: row.submitterEmail }
        : null,
    definition: form,
    answers: Object.fromEntries(
      answerRows.map(({ componentId, value }) => [componentId, value]),
    ),
  };
}

/**
 * Any submission in the org, for admins (#317). Null when it doesn't exist or
 * belongs to another org.
 */
async function getSubmissionDetail(
  organizationId: string,
  submissionId: string,
): Promise<SubmissionDetail | null> {
  const [row] = await db
    .select(submissionColumns)
    .from(formSubmissions)
    .leftJoin(users, eq(users.id, formSubmissions.userId))
    .where(
      and(
        eq(formSubmissions.id, submissionId),
        eq(formSubmissions.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ? toDetail(organizationId, row) : null;
}

/**
 * A member's latest submission to a form, by its human-assigned form ID, for
 * showing them their own response (#318, #319). Null when they haven't
 * responded.
 */
async function getMemberSubmission(
  organizationId: string,
  formId: string,
  userId: string,
): Promise<SubmissionDetail | null> {
  const definition = await getDefinition(organizationId, formId);
  if (!definition) return null;

  const [row] = await db
    .select(submissionColumns)
    .from(formSubmissions)
    .leftJoin(users, eq(users.id, formSubmissions.userId))
    .where(
      and(
        eq(formSubmissions.formId, definition.id),
        eq(formSubmissions.organizationId, organizationId),
        eq(formSubmissions.userId, userId),
      ),
    )
    .orderBy(desc(formSubmissions.submittedAt), desc(formSubmissions.id))
    .limit(1);
  return row ? toDetail(organizationId, row, definition) : null;
}

/** An upload the user made to one of the org's forms, by its form ID. */
async function getMemberUpload(
  organizationId: string,
  formId: string,
  uploadId: string,
  userId: string,
) {
  const [upload] = await db
    .select({
      fileName: formUploads.fileName,
      contentType: formUploads.contentType,
    })
    .from(formUploads)
    .innerJoin(forms, eq(forms.id, formUploads.formId))
    .where(
      and(
        eq(formUploads.id, uploadId),
        eq(formUploads.organizationId, organizationId),
        eq(formUploads.uploadedBy, userId),
        eq(forms.organizationId, organizationId),
        eq(forms.formId, formId),
      ),
    )
    .limit(1);
  return upload ?? null;
}

export const FormSubmissionService = {
  getDefinition,
  getPublishedDefinition,
  isMemberSubmissionEditable,
  submit,
  updateMemberSubmission,
  createUpload,
  deleteUpload,
  getSubmissionDetail,
  getMemberSubmission,
  getMemberUpload,
};
