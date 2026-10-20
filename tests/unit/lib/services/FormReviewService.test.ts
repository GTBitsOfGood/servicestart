// @vitest-environment node
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  FormStatus,
  SubmissionReviewStatus,
  formSubmissions,
} from "@/lib/schema";
import {
  FormReviewService,
  SubmissionNotFoundError,
} from "@/lib/services/FormReviewService";
import {
  buildTestUser,
  createForm,
  createFormSubmission,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

async function createUser() {
  const { user } = await signUpAndGetSession(buildTestUser());
  return user.id;
}

async function statusOf(id: string) {
  const [row] = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.id, id));
  return row;
}

describe("FormReviewService.setReviewStatus", () => {
  it("sets the status and who changed it", async () => {
    const org = await createOrganization("camp");
    const [adminId, applicantId] = [await createUser(), await createUser()];
    const form = await createForm(org.id, { status: FormStatus.Published });
    const id = await createFormSubmission(form, { userId: applicantId });

    const changes = await FormReviewService.setReviewStatus({
      organizationId: org.id,
      submissionIds: [id],
      status: SubmissionReviewStatus.Accepted,
      actorId: adminId,
    });

    expect(changes).toEqual([
      {
        id,
        formId: form.id,
        userId: applicantId,
        previousStatus: SubmissionReviewStatus.Pending,
        reviewStatus: SubmissionReviewStatus.Accepted,
        changed: true,
      },
    ]);
    const row = await statusOf(id);
    expect(row.reviewStatus).toBe(SubmissionReviewStatus.Accepted);
    expect(row.reviewStatusUpdatedBy).toBe(adminId);
    expect(row.reviewStatusUpdatedAt).toBeInstanceOf(Date);
  });

  it("leaves submissions that already have the status alone", async () => {
    const org = await createOrganization("camp");
    const adminId = await createUser();
    const form = await createForm(org.id, { status: FormStatus.Published });
    const id = await createFormSubmission(form, {
      reviewStatus: SubmissionReviewStatus.UnderReview,
    });

    const [change] = await FormReviewService.setReviewStatus({
      organizationId: org.id,
      submissionIds: [id],
      status: SubmissionReviewStatus.UnderReview,
      actorId: adminId,
    });

    expect(change.changed).toBe(false);
    expect((await statusOf(id)).reviewStatusUpdatedBy).toBeNull();
  });

  it("changes several submissions at once", async () => {
    const org = await createOrganization("camp");
    const adminId = await createUser();
    const form = await createForm(org.id, { status: FormStatus.Published });
    const ids = [
      await createFormSubmission(form),
      await createFormSubmission(form),
    ];

    const changes = await FormReviewService.setReviewStatus({
      organizationId: org.id,
      submissionIds: [...ids, ids[0]],
      status: SubmissionReviewStatus.Rejected,
      actorId: adminId,
    });

    expect(changes.map(({ id }) => id).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect((await statusOf(id)).reviewStatus).toBe(
        SubmissionReviewStatus.Rejected,
      );
    }
  });

  it("changes nothing when any submission is in another organization", async () => {
    const orgA = await createOrganization("camp-a");
    const orgB = await createOrganization("camp-b");
    const adminId = await createUser();
    const formA = await createForm(orgA.id, { status: FormStatus.Published });
    const formB = await createForm(orgB.id, { status: FormStatus.Published });
    const idA = await createFormSubmission(formA);
    const idB = await createFormSubmission(formB);

    await expect(
      FormReviewService.setReviewStatus({
        organizationId: orgB.id,
        submissionIds: [idB, idA],
        status: SubmissionReviewStatus.Accepted,
        actorId: adminId,
      }),
    ).rejects.toBeInstanceOf(SubmissionNotFoundError);

    expect((await statusOf(idA)).reviewStatus).toBe(
      SubmissionReviewStatus.Pending,
    );
    expect((await statusOf(idB)).reviewStatus).toBe(
      SubmissionReviewStatus.Pending,
    );
  });
});
