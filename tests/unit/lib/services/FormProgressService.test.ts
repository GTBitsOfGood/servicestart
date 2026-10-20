// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FormStatus, MemberType, SubmissionReviewStatus } from "@/lib/schema";
import { FormProgressService } from "@/lib/services/FormProgressService";
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

function assignedTo(memberTypes: MemberType[], dueAt: string | null = null) {
  return { assignedMemberTypes: memberTypes, dueAt };
}

describe("FormProgressService.listForMember", () => {
  it("lists forms assigned to the member's type, soonest due first", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    const later = await createForm(org.id, {
      title: "Consent Form",
      status: FormStatus.Published,
      settings: assignedTo([MemberType.Attendee], "2027-05-01T00:00:00Z"),
    });
    const sooner = await createForm(org.id, {
      title: "Medical History",
      status: FormStatus.Published,
      settings: assignedTo([MemberType.Attendee], "2027-04-01T00:00:00Z"),
    });
    const undated = await createForm(org.id, {
      title: "A Survey",
      status: FormStatus.Published,
      settings: assignedTo([MemberType.Attendee, MemberType.Applicant]),
    });

    const progress = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberType.Attendee,
    );

    expect(progress.map(({ form }) => form.id)).toEqual([
      sooner.id,
      later.id,
      undated.id,
    ]);
    expect(progress[0]).toMatchObject({
      form: {
        formId: sooner.formId,
        title: "Medical History",
        dueAt: "2027-04-01T00:00:00Z",
        availability: "open",
      },
      required: true,
      submission: null,
    });
  });

  it("leaves out drafts, other types' forms, and unassigned forms", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    await createForm(org.id, {
      status: FormStatus.Draft,
      settings: assignedTo([MemberType.Attendee]),
    });
    await createForm(org.id, {
      status: FormStatus.Published,
      settings: assignedTo([MemberType.Applicant]),
    });
    await createForm(org.id, { status: FormStatus.Published });

    expect(
      await FormProgressService.listForMember(
        org.id,
        userId,
        MemberType.Attendee,
      ),
    ).toEqual([]);
  });

  it("includes closed forms and says they're closed", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    await createForm(org.id, {
      status: FormStatus.Closed,
      settings: assignedTo([MemberType.Attendee]),
    });

    const [progress] = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberType.Attendee,
    );
    expect(progress.form.availability).toBe("closed");
  });

  it("includes forms the member responded to, with their latest submission", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    const form = await createForm(org.id, {
      status: FormStatus.Published,
      settings: { allowMultipleSubmissions: true },
    });
    await createFormSubmission(form, {
      userId,
      submittedAt: new Date("2027-01-01T00:00:00Z"),
    });
    const latestId = await createFormSubmission(form, {
      userId,
      submittedAt: new Date("2027-02-01T00:00:00Z"),
      updatedAt: new Date("2027-02-02T00:00:00Z"),
      reviewStatus: SubmissionReviewStatus.UnderReview,
    });

    const progress = await FormProgressService.listForMember(
      org.id,
      userId,
      null,
    );

    expect(progress).toHaveLength(1);
    expect(progress[0].required).toBe(false);
    expect(progress[0].submission).toEqual({
      id: latestId,
      submittedAt: new Date("2027-02-01T00:00:00Z"),
      updatedAt: new Date("2027-02-02T00:00:00Z"),
      reviewStatus: SubmissionReviewStatus.UnderReview,
    });
  });

  it("only counts the member's own submissions", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    const otherId = await createUser();
    const form = await createForm(org.id, {
      status: FormStatus.Published,
      settings: assignedTo([MemberType.Attendee]),
    });
    await createFormSubmission(form, { userId: otherId });

    const [progress] = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberType.Attendee,
    );
    expect(progress.submission).toBeNull();
  });

  it("never lists another organization's forms or submissions", async () => {
    const orgA = await createOrganization("camp-a");
    const orgB = await createOrganization("camp-b");
    const userId = await createUser();
    const formA = await createForm(orgA.id, {
      status: FormStatus.Published,
      settings: assignedTo([MemberType.Attendee]),
    });
    await createFormSubmission(formA, { userId });

    expect(
      await FormProgressService.listForMember(
        orgB.id,
        userId,
        MemberType.Attendee,
      ),
    ).toEqual([]);
  });
});
