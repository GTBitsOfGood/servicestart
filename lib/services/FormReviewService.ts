import { and, eq, inArray, ne } from "drizzle-orm";
import db from "@/lib/db";
import { formSubmissions, type SubmissionReviewStatus } from "@/lib/schema";

/** A submission ID that isn't in the organization. */
export class SubmissionNotFoundError extends Error {
  constructor() {
    super("Submission not found");
    this.name = "SubmissionNotFoundError";
  }
}

export type ReviewStatusChange = {
  id: string;
  /** The form's UUID. */
  formId: string;
  userId: string | null;
  previousStatus: SubmissionReviewStatus;
  reviewStatus: SubmissionReviewStatus;
  /** False when the submission already had this status. */
  changed: boolean;
};

/**
 * Sets the review status of submissions in one organization. Throws
 * SubmissionNotFoundError, changing nothing, if any ID belongs to another
 * org or doesn't exist. Submissions that already have the status are left
 * as is and reported with `changed: false`.
 *
 * #316 adds what follows a change (notifying the submitter, and moving
 * accepted submitters to the form's acceptedMemberType) inside this
 * transaction.
 */
async function setReviewStatus({
  organizationId,
  submissionIds,
  status,
  actorId,
}: {
  organizationId: string;
  submissionIds: string[];
  status: SubmissionReviewStatus;
  actorId: string;
}): Promise<ReviewStatusChange[]> {
  const ids = [...new Set(submissionIds)];
  if (ids.length === 0) return [];

  return db.transaction(async (tx) => {
    const current = await tx
      .select({
        id: formSubmissions.id,
        formId: formSubmissions.formId,
        userId: formSubmissions.userId,
        reviewStatus: formSubmissions.reviewStatus,
      })
      .from(formSubmissions)
      .where(
        and(
          inArray(formSubmissions.id, ids),
          eq(formSubmissions.organizationId, organizationId),
        ),
      )
      .for("update");
    if (current.length !== ids.length) throw new SubmissionNotFoundError();

    await tx
      .update(formSubmissions)
      .set({
        reviewStatus: status,
        reviewStatusUpdatedAt: new Date(),
        reviewStatusUpdatedBy: actorId,
      })
      .where(
        and(
          inArray(formSubmissions.id, ids),
          eq(formSubmissions.organizationId, organizationId),
          ne(formSubmissions.reviewStatus, status),
        ),
      );

    return current.map((row) => ({
      id: row.id,
      formId: row.formId,
      userId: row.userId,
      previousStatus: row.reviewStatus,
      reviewStatus: status,
      changed: row.reviewStatus !== status,
    }));
  });
}

export const FormReviewService = {
  setReviewStatus,
};
