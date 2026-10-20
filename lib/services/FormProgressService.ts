import { and, desc, eq, inArray } from "drizzle-orm";
import db from "@/lib/db";
import {
  FormStatus,
  formSubmissions,
  forms,
  type MemberType,
  type SubmissionReviewStatus,
} from "@/lib/schema";
import { getAssignedMemberTypes, getDueAt } from "@/lib/forms/schema";
import {
  getFormAvailability,
  type FormAvailability,
} from "@/lib/forms/submission";

/** Where a member stands on one form. */
export type MemberFormProgress = {
  form: {
    /** The UUID. */
    id: string;
    /** The human-assigned key in the form's URL. */
    formId: string;
    title: string;
    description: string | null;
    status: FormStatus;
    opensAt: string | null;
    closesAt: string | null;
    dueAt: string | null;
    availability: FormAvailability;
  };
  /** The form is assigned to the member's type. */
  required: boolean;
  /** Their latest submission, or null if they haven't responded. */
  submission: {
    id: string;
    submittedAt: Date;
    updatedAt: Date | null;
    reviewStatus: SubmissionReviewStatus;
  } | null;
};

function byDueDateThenTitle(a: MemberFormProgress, b: MemberFormProgress) {
  if (a.required !== b.required) return a.required ? -1 : 1;
  const dueA = a.form.dueAt ? Date.parse(a.form.dueAt) : Infinity;
  const dueB = b.form.dueAt ? Date.parse(b.form.dueAt) : Infinity;
  return dueA - dueB || a.form.title.localeCompare(b.form.title);
}

/**
 * Every published or closed form in the org that's assigned to the member's
 * type, plus any they've responded to, with their latest submission to each.
 * Required forms come first, soonest due first. Used by the dashboards (#318,
 * #319) and the admin submission page (#317).
 */
async function listForMember(
  organizationId: string,
  userId: string,
  memberType: MemberType | null,
  now = new Date(),
): Promise<MemberFormProgress[]> {
  const [formRows, submissionRows] = await Promise.all([
    db
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
        and(
          eq(forms.organizationId, organizationId),
          inArray(forms.status, [FormStatus.Published, FormStatus.Closed]),
        ),
      ),
    db
      .select({
        id: formSubmissions.id,
        formId: formSubmissions.formId,
        submittedAt: formSubmissions.submittedAt,
        updatedAt: formSubmissions.updatedAt,
        reviewStatus: formSubmissions.reviewStatus,
      })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.organizationId, organizationId),
          eq(formSubmissions.userId, userId),
        ),
      )
      .orderBy(desc(formSubmissions.submittedAt), desc(formSubmissions.id)),
  ]);

  // Rows are newest first, so the first one per form is the latest.
  const latest = new Map<string, (typeof submissionRows)[number]>();
  for (const row of submissionRows) {
    if (!latest.has(row.formId)) latest.set(row.formId, row);
  }

  return formRows
    .flatMap((form): MemberFormProgress[] => {
      const required =
        memberType !== null &&
        getAssignedMemberTypes(form.settings).includes(memberType);
      const submission = latest.get(form.id) ?? null;
      if (!required && !submission) return [];
      return [
        {
          form: {
            id: form.id,
            formId: form.formId,
            title: form.title,
            description: form.description,
            status: form.status,
            opensAt: form.settings.opensAt,
            closesAt: form.settings.closesAt,
            dueAt: getDueAt(form.settings),
            availability: getFormAvailability(form, now),
          },
          required,
          submission: submission && {
            id: submission.id,
            submittedAt: submission.submittedAt,
            updatedAt: submission.updatedAt,
            reviewStatus: submission.reviewStatus,
          },
        },
      ];
    })
    .sort(byDueDateThenTitle);
}

export const FormProgressService = {
  listForMember,
};
