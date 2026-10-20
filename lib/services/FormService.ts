import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import db from "@/lib/db";
import {
  forms,
  formComponents,
  formSubmissions,
  formAnswers,
  formUploads,
  users,
  FormStatus,
  FormComponentType,
} from "@/lib/schema";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import { FORM_COMPONENT_CONFIG_SCHEMAS } from "@/lib/forms/schema";
import {
  CreateFormSchema,
  UpdateFormSchema,
  FormError,
  csvCell,
} from "@/lib/forms/management";

const scope = (organizationId: string, formId: string) =>
  and(eq(forms.organizationId, organizationId), eq(forms.formId, formId));
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockedForm(
  tx: Transaction,
  organizationId: string,
  formId: string,
) {
  const [form] = await tx
    .select()
    .from(forms)
    .where(scope(organizationId, formId))
    .for("update");
  if (!form) throw new FormError("not-found", "Form not found");
  return form;
}

// Drizzle wraps PostgreSQL errors in a query error.
function rethrowUnique(error: unknown): never {
  let cause = error;
  while (cause instanceof Error) {
    if (
      "code" in cause &&
      cause.code === "23505" &&
      "constraint" in cause &&
      cause.constraint === "forms_organization_id_form_id_unique"
    ) {
      throw new FormError(
        "conflict",
        "This form ID is already in use",
        "formId",
      );
    }
    cause = cause.cause;
  }
  throw error;
}

async function create(
  organizationId: string,
  createdBy: string,
  input: z.infer<typeof CreateFormSchema>,
) {
  const values = CreateFormSchema.parse(input);
  try {
    const [form] = await db
      .insert(forms)
      .values({
        ...values,
        organizationId,
        createdBy,
        settings: { ...DEFAULT_FORM_SETTINGS },
      })
      .returning();
    return form;
  } catch (error) {
    rethrowUnique(error);
  }
}

async function list(organizationId: string) {
  const rows = await db
    .select()
    .from(forms)
    .where(eq(forms.organizationId, organizationId))
    .orderBy(desc(forms.updatedAt), asc(forms.id));
  // Aggregate independently so questions × submissions never inflate counts.
  const [questions, responses] = await Promise.all([
    db
      .select({
        formId: formComponents.formId,
        type: formComponents.type,
        count: count(),
      })
      .from(formComponents)
      .where(
        and(
          eq(formComponents.organizationId, organizationId),
          isNull(formComponents.archivedAt),
        ),
      )
      .groupBy(formComponents.formId, formComponents.type),
    db
      .select({ formId: formSubmissions.formId, count: count() })
      .from(formSubmissions)
      .where(eq(formSubmissions.organizationId, organizationId))
      .groupBy(formSubmissions.formId),
  ]);
  const questionCounts = new Map<string, number>();
  for (const row of questions)
    if (row.type !== FormComponentType.SectionHeader)
      questionCounts.set(
        row.formId,
        (questionCounts.get(row.formId) ?? 0) + row.count,
      );
  const responseCounts = new Map(
    responses.map((row) => [row.formId, row.count]),
  );
  return rows.map((row) => ({
    ...row,
    questionCount: questionCounts.get(row.id) ?? 0,
    responseCount: responseCounts.get(row.id) ?? 0,
  }));
}

async function get(organizationId: string, formId: string) {
  const [form] = await db
    .select()
    .from(forms)
    .where(scope(organizationId, formId));
  if (!form) throw new FormError("not-found", "Form not found");
  return form;
}

async function update(
  organizationId: string,
  formId: string,
  input: z.infer<typeof UpdateFormSchema>,
) {
  const values = UpdateFormSchema.parse(input);
  try {
    return await db.transaction(async (tx) => {
      const form = await lockedForm(tx, organizationId, formId);
      if (
        values.formId &&
        values.formId !== form.formId &&
        form.status !== FormStatus.Draft
      )
        throw new FormError(
          "conflict",
          "Only draft form IDs can change",
          "formId",
        );
      const [updated] = await tx
        .update(forms)
        .set({ ...values, updatedAt: new Date() })
        .where(scope(organizationId, formId))
        .returning();
      return updated;
    });
  } catch (error) {
    rethrowUnique(error);
  }
}

async function transition(
  organizationId: string,
  formId: string,
  action: "publish" | "close" | "reopen",
) {
  return db.transaction(async (tx) => {
    const form = await lockedForm(tx, organizationId, formId);
    const expected = {
      publish: FormStatus.Draft,
      close: FormStatus.Published,
      reopen: FormStatus.Closed,
    }[action];
    if (form.status !== expected)
      throw new FormError("conflict", `Cannot ${action} a ${form.status} form`);
    if (action === "publish") {
      const components = await tx
        .select()
        .from(formComponents)
        .where(
          and(
            eq(formComponents.organizationId, organizationId),
            eq(formComponents.formId, form.id),
            isNull(formComponents.archivedAt),
          ),
        )
        .orderBy(asc(formComponents.position));
      if (
        !components.some(
          (component) => component.type !== FormComponentType.SectionHeader,
        )
      )
        throw new FormError(
          "invalid",
          "Add at least one question before publishing",
        );
      for (const component of components) {
        const result = FORM_COMPONENT_CONFIG_SCHEMAS[component.type].safeParse(
          component.config,
        );
        if (!result.success)
          throw new FormError(
            "invalid",
            `${component.label}: ${result.error.issues.map((issue) => issue.message).join("; ")}`,
          );
      }
    }
    const [updated] = await tx
      .update(forms)
      .set({
        status: action === "close" ? FormStatus.Closed : FormStatus.Published,
      })
      .where(scope(organizationId, formId))
      .returning();
    return updated;
  });
}

async function remove(organizationId: string, formId: string) {
  await db.transaction(async (tx) => {
    const form = await lockedForm(tx, organizationId, formId);
    const [submission] = await tx
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.organizationId, organizationId),
          eq(formSubmissions.formId, form.id),
        ),
      )
      .limit(1);
    if (form.status !== FormStatus.Draft || submission)
      throw new FormError(
        "conflict",
        "Only drafts with no submissions can be deleted",
      );
    await tx.delete(forms).where(scope(organizationId, formId));
  });
}

async function getUpload(
  organizationId: string,
  formId: string,
  uploadId: string,
) {
  const form = await get(organizationId, formId);
  const [upload] = await db
    .select()
    .from(formUploads)
    .where(
      and(
        eq(formUploads.organizationId, organizationId),
        eq(formUploads.formId, form.id),
        eq(formUploads.id, uploadId),
      ),
    );
  if (!upload) throw new FormError("not-found", "File not found");
  return upload;
}

async function exportCsv(
  organizationId: string,
  formId: string,
  origin: string,
) {
  const form = await get(organizationId, formId);
  const components = (
    await db
      .select()
      .from(formComponents)
      .where(
        and(
          eq(formComponents.organizationId, organizationId),
          eq(formComponents.formId, form.id),
          isNull(formComponents.archivedAt),
        ),
      )
      .orderBy(asc(formComponents.position), asc(formComponents.id))
  ).filter((component) => component.type !== FormComponentType.SectionHeader);
  const submissions = await db
    .select({
      id: formSubmissions.id,
      submittedAt: formSubmissions.submittedAt,
      name: users.name,
      email: users.email,
    })
    .from(formSubmissions)
    .leftJoin(users, eq(users.id, formSubmissions.userId))
    .where(
      and(
        eq(formSubmissions.organizationId, organizationId),
        eq(formSubmissions.formId, form.id),
      ),
    )
    .orderBy(asc(formSubmissions.submittedAt), asc(formSubmissions.id));
  const answers = await db
    .select({
      submissionId: formAnswers.submissionId,
      componentId: formAnswers.componentId,
      value: formAnswers.value,
    })
    .from(formAnswers)
    .innerJoin(
      formSubmissions,
      eq(formSubmissions.id, formAnswers.submissionId),
    )
    .where(
      and(
        eq(formAnswers.formId, form.id),
        eq(formSubmissions.organizationId, organizationId),
        eq(formSubmissions.formId, form.id),
      ),
    );
  const values = new Map(
    answers.map((answer) => [
      `${answer.submissionId}:${answer.componentId}`,
      answer.value,
    ]),
  );
  const rows: (string | number)[][] = [
    [
      "Submitter name",
      "Submitter email",
      "Submitted at",
      ...components.map((component) => component.label),
    ],
  ];
  for (const submission of submissions)
    rows.push([
      submission.name ?? "",
      submission.email ?? "",
      submission.submittedAt.toISOString(),
      ...components.map((component) => {
        const value = values.get(`${submission.id}:${component.id}`);
        if (value === undefined) return "";
        if (typeof value === "object")
          return new URL(
            `/api/forms/${encodeURIComponent(formId)}/uploads/${value.uploadId}`,
            origin,
          ).href;
        return value;
      }),
    ]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const FormService = {
  create,
  list,
  get,
  update,
  transition,
  remove,
  getUpload,
  exportCsv,
};
