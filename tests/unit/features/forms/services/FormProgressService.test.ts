// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FormStatus, SubmissionReviewStatus } from "@/core/db/schema";
import { FormProgressService } from "@/features/forms/services/FormProgressService";
import { FormDraftService } from "@/features/forms/services/FormDraftService";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
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

function assignedTo(memberTypes: string[], dueAt: string | null = null) {
  return {
    assignedMemberTypes: memberTypes.map((key) =>
      MemberTypeKeySchema.parse(key),
    ),
    dueAt,
  };
}

describe("FormProgressService.listForMember", () => {
  it("lists forms assigned to the member's type, soonest due first", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    const later = await createForm(org.id, {
      title: "Consent Form",
      status: FormStatus.Published,
      settings: assignedTo(["attendee"], "2027-05-01T00:00:00Z"),
    });
    const sooner = await createForm(org.id, {
      title: "Medical History",
      status: FormStatus.Published,
      settings: assignedTo(["attendee"], "2027-04-01T00:00:00Z"),
    });
    const undated = await createForm(org.id, {
      title: "A Survey",
      status: FormStatus.Published,
      settings: assignedTo(["attendee", "applicant"]),
    });

    const progress = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberTypeKeySchema.parse("attendee"),
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
      draft: null,
    });
  });

  it("includes the member's draft updatedAt without treating it as a submission", async () => {
    const org = await createOrganization("camp-draft");
    const userId = await createUser();
    const form = await createForm(org.id, {
      status: FormStatus.Published,
      settings: assignedTo(["attendee"]),
    });
    const saved = await FormDraftService.save({
      organizationId: org.id,
      formId: form.formId,
      userId,
      answers: {},
    });

    const [progress] = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberTypeKeySchema.parse("attendee"),
    );

    expect(saved).not.toBeNull();
    expect(progress.submission).toBeNull();
    expect(progress.draft).toEqual({ updatedAt: saved!.updatedAt });
  });

  it("includes an unassigned form when the member has a draft", async () => {
    const org = await createOrganization("optional-draft");
    const userId = await createUser();
    const form = await createForm(org.id, { status: FormStatus.Published });
    await FormDraftService.save({
      organizationId: org.id,
      formId: form.formId,
      userId,
      answers: {},
    });

    const progress = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberTypeKeySchema.parse("attendee"),
    );

    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ required: false, submission: null });
    expect(progress[0].draft?.updatedAt).toBeInstanceOf(Date);
  });

  it("leaves out drafts, other types' forms, and unassigned forms", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    await createForm(org.id, {
      status: FormStatus.Draft,
      settings: assignedTo(["attendee"]),
    });
    await createForm(org.id, {
      status: FormStatus.Published,
      settings: assignedTo(["applicant"]),
    });
    await createForm(org.id, { status: FormStatus.Published });

    expect(
      await FormProgressService.listForMember(
        org.id,
        userId,
        MemberTypeKeySchema.parse("attendee"),
      ),
    ).toEqual([]);
  });

  it("includes closed forms and says they're closed", async () => {
    const org = await createOrganization("camp");
    const userId = await createUser();
    await createForm(org.id, {
      status: FormStatus.Closed,
      settings: assignedTo(["attendee"]),
    });

    const [progress] = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberTypeKeySchema.parse("attendee"),
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
      settings: assignedTo(["attendee"]),
    });
    await createFormSubmission(form, { userId: otherId });
    await FormDraftService.save({
      organizationId: org.id,
      formId: form.formId,
      userId: otherId,
      answers: {},
    });

    const [progress] = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberTypeKeySchema.parse("attendee"),
    );
    expect(progress.submission).toBeNull();
    expect(progress.draft).toBeNull();
  });

  it("lists a form assigned to volunteer for a volunteer member", async () => {
    const org = await createOrganization("volunteer-org", {
      memberTypes: [
        {
          key: MemberTypeKeySchema.parse("volunteer"),
          label: "Volunteer",
          pluralLabel: "Volunteers",
        },
        {
          key: MemberTypeKeySchema.parse("staff"),
          label: "Staff",
          pluralLabel: "Staff",
        },
      ],
    });
    const userId = await createUser();
    const volunteerForm = await createForm(org.id, {
      title: "Volunteer intake",
      status: FormStatus.Published,
      settings: assignedTo(["volunteer"]),
    });
    await createForm(org.id, {
      title: "Staff only",
      status: FormStatus.Published,
      settings: assignedTo(["staff"]),
    });

    const progress = await FormProgressService.listForMember(
      org.id,
      userId,
      MemberTypeKeySchema.parse("volunteer"),
    );

    expect(progress).toHaveLength(1);
    expect(progress[0].form.id).toBe(volunteerForm.id);
    expect(progress[0].required).toBe(true);
  });

  it("never lists another organization's forms or submissions", async () => {
    const orgA = await createOrganization("camp-a");
    const orgB = await createOrganization("camp-b");
    const userId = await createUser();
    const formA = await createForm(orgA.id, {
      status: FormStatus.Published,
      settings: assignedTo(["attendee"]),
    });
    await createFormSubmission(formA, { userId });
    await FormDraftService.save({
      organizationId: orgA.id,
      formId: formA.formId,
      userId,
      answers: {},
    });

    expect(
      await FormProgressService.listForMember(
        orgB.id,
        userId,
        MemberTypeKeySchema.parse("attendee"),
      ),
    ).toEqual([]);
  });
});
