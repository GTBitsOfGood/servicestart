// @vitest-environment node
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  FormComponentType,
  FormStatus,
  SubmissionReviewStatus,
  formAnswers,
  formComponents,
  formSubmissions,
  forms,
} from "@/lib/schema";
import type { FormSettings } from "@/lib/forms/schema";
import {
  DuplicateSubmissionError,
  FormSubmissionService,
  InvalidUploadError,
  SubmissionNotEditableError,
} from "@/lib/services/FormSubmissionService";
import {
  VISIONARIES_APPLICATION_FORM,
  buildSampleAnswers,
  buildTestUser,
  createForm,
  createFormSubmission,
  createFormUpload,
  createOrganization,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

async function createUser() {
  const { user } = await signUpAndGetSession(buildTestUser());
  return user.id;
}

describe("FormSubmissionService.getDefinition", () => {
  it("returns the form and its components in order", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });

    const definition = await FormSubmissionService.getDefinition(
      org.id,
      form.formId,
    );

    expect(definition).toEqual({ ...form, organizationId: undefined });
    expect(definition?.components.map(({ label }) => label)).toEqual(
      VISIONARIES_APPLICATION_FORM.components.map(({ label }) => label),
    );
  });

  it("leaves out archived components", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id);
    const [archived] = form.components;
    await db
      .update(formComponents)
      .set({ archivedAt: new Date() })
      .where(eq(formComponents.id, archived.id));

    const definition = await FormSubmissionService.getDefinition(
      org.id,
      form.formId,
    );
    expect(definition?.components.map(({ id }) => id)).not.toContain(
      archived.id,
    );
  });

  it("doesn't return another org's form", async () => {
    const orgA = await createOrganization("org-a");
    const orgB = await createOrganization("org-b");
    const form = await createForm(orgA.id);

    expect(
      await FormSubmissionService.getDefinition(orgB.id, form.formId),
    ).toBeNull();
  });
});

describe("FormSubmissionService.getPublishedDefinition", () => {
  it.each([
    [FormStatus.Draft, false],
    [FormStatus.Published, true],
    [FormStatus.Closed, true],
  ])("for a %s form, returns it: %s", async (status, returned) => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status });

    const definition = await FormSubmissionService.getPublishedDefinition(
      org.id,
      form.formId,
    );
    expect(definition?.id ?? null).toBe(returned ? form.id : null);
  });
});

describe("FormSubmissionService.submit", () => {
  it("writes the submission and its answers", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });
    const userId = await createUser();
    const uploadId = await createFormUpload(form, { uploadedBy: userId });
    const answers = buildSampleAnswers(form, { uploadId });

    const id = await FormSubmissionService.submit({
      form,
      organizationId: org.id,
      userId,
      answers,
    });

    const rows = await db
      .select()
      .from(formAnswers)
      .where(eq(formAnswers.submissionId, id));
    expect(
      Object.fromEntries(rows.map((row) => [row.componentId, row.value])),
    ).toEqual(answers);
    expect(
      await FormSubmissionService.isMemberSubmissionEditable({
        form,
        organizationId: org.id,
        userId,
      }),
    ).toBe(true);
  });

  it("throws on a second submission from the same user", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, {
      status: FormStatus.Published,
      components: [],
    });
    const userId = await createUser();
    await createFormSubmission(form, { userId });

    await expect(
      FormSubmissionService.submit({
        form,
        organizationId: org.id,
        userId,
        answers: {},
      }),
    ).rejects.toBeInstanceOf(DuplicateSubmissionError);
  });

  it("writes nothing when an upload is invalid", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });
    const userId = await createUser();
    const uploadId = await createFormUpload(form, {
      uploadedBy: await createUser(),
    });
    const image = form.components.find(
      ({ type }) => type === FormComponentType.Image,
    )!;

    const error = await FormSubmissionService.submit({
      form,
      organizationId: org.id,
      userId,
      answers: buildSampleAnswers(form, { uploadId }),
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(InvalidUploadError);
    expect((error as InvalidUploadError).componentId).toBe(image.id);
    expect(await db.select().from(formSubmissions)).toHaveLength(0);
    expect(await db.select().from(formAnswers)).toHaveLength(0);
  });
});

describe("FormSubmissionService.isMemberSubmissionEditable", () => {
  it("is null when the member hasn't responded", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });
    const userId = await createUser();

    expect(
      await FormSubmissionService.isMemberSubmissionEditable({
        form,
        organizationId: org.id,
        userId,
      }),
    ).toBeNull();
  });

  it("is true for a pending response to an open form", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });
    const userId = await createUser();
    await createFormSubmission(form, { userId });

    expect(
      await FormSubmissionService.isMemberSubmissionEditable({
        form,
        organizationId: org.id,
        userId,
      }),
    ).toBe(true);
  });

  it("is false once the response has been reviewed", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });
    const userId = await createUser();
    await createFormSubmission(form, {
      userId,
      reviewStatus: SubmissionReviewStatus.Accepted,
    });

    expect(
      await FormSubmissionService.isMemberSubmissionEditable({
        form,
        organizationId: org.id,
        userId,
      }),
    ).toBe(false);
  });

  it("is false when the form is closed", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Closed });
    const userId = await createUser();
    await createFormSubmission(form, { userId });

    expect(
      await FormSubmissionService.isMemberSubmissionEditable({
        form,
        organizationId: org.id,
        userId,
      }),
    ).toBe(false);
  });

  it("ignores another organization's submission", async () => {
    const org = await createOrganization("acme");
    const other = await createOrganization("other");
    const form = await createForm(org.id, { status: FormStatus.Published });
    const userId = await createUser();
    await createFormSubmission(form, { userId });

    expect(
      await FormSubmissionService.isMemberSubmissionEditable({
        form,
        organizationId: other.id,
        userId,
      }),
    ).toBeNull();
  });
});

describe("FormSubmissionService.updateMemberSubmission", () => {
  async function setup(settings: Partial<FormSettings> = {}) {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, {
      status: FormStatus.Published,
      settings,
    });
    const userId = await createUser();
    const oldUpload = await createFormUpload(form, { uploadedBy: userId });
    const original = buildSampleAnswers(form, { uploadId: oldUpload });
    const submissionId = await FormSubmissionService.submit({
      form,
      organizationId: org.id,
      userId,
      answers: original,
    });
    return { org, form, userId, submissionId, original };
  }

  async function answersOf(submissionId: string) {
    const rows = await db
      .select()
      .from(formAnswers)
      .where(eq(formAnswers.submissionId, submissionId));
    return Object.fromEntries(rows.map((row) => [row.componentId, row.value]));
  }

  it("replaces the answers and sets updatedAt", async () => {
    const { org, form, userId, submissionId } = await setup();
    const uploadId = await createFormUpload(form, { uploadedBy: userId });
    const shortText = form.components.find(
      ({ type }) => type === FormComponentType.ShortText,
    )!;
    const answers = {
      ...buildSampleAnswers(form, { uploadId }),
      [shortText.id]: "Changed",
    };

    const id = await FormSubmissionService.updateMemberSubmission({
      form,
      organizationId: org.id,
      userId,
      answers,
    });

    expect(id).toBe(submissionId);
    expect(await answersOf(submissionId)).toEqual(answers);
    const [row] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId));
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("keeps updatedAt null until the first edit", async () => {
    const { submissionId } = await setup();
    const [row] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId));
    expect(row.updatedAt).toBeNull();
  });

  it("keeps the review status", async () => {
    const { org, form, userId, submissionId, original } = await setup();
    const [before] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId));

    await FormSubmissionService.updateMemberSubmission({
      form,
      organizationId: org.id,
      userId,
      answers: original,
    });

    const [row] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId));
    expect(row.reviewStatus).toBe(SubmissionReviewStatus.Pending);
    expect(row.reviewStatus).toBe(before.reviewStatus);
    expect(row.reviewStatusUpdatedAt).toEqual(before.reviewStatusUpdatedAt);
  });

  it("rejects a close that landed after the caller loaded the form", async () => {
    const { org, form, userId, submissionId, original } = await setup();
    await db
      .update(forms)
      .set({ status: FormStatus.Closed })
      .where(eq(forms.id, form.id));
    const shortText = form.components.find(
      ({ type }) => type === FormComponentType.ShortText,
    )!;

    await expect(
      FormSubmissionService.updateMemberSubmission({
        form,
        organizationId: org.id,
        userId,
        answers: { ...original, [shortText.id]: "Changed" },
      }),
    ).rejects.toBeInstanceOf(SubmissionNotEditableError);
    expect(await answersOf(submissionId)).toEqual(original);
  });

  it("throws and changes nothing once the submission is reviewed", async () => {
    const { org, form, userId, submissionId, original } = await setup();
    await db
      .update(formSubmissions)
      .set({ reviewStatus: SubmissionReviewStatus.Rejected })
      .where(eq(formSubmissions.id, submissionId));
    const shortText = form.components.find(
      ({ type }) => type === FormComponentType.ShortText,
    )!;

    await expect(
      FormSubmissionService.updateMemberSubmission({
        form,
        organizationId: org.id,
        userId,
        answers: { ...original, [shortText.id]: "Changed" },
      }),
    ).rejects.toBeInstanceOf(SubmissionNotEditableError);
    expect(await answersOf(submissionId)).toEqual(original);
  });

  it("returns null when the member hasn't responded", async () => {
    const { org, form, original } = await setup();

    const id = await FormSubmissionService.updateMemberSubmission({
      form,
      organizationId: org.id,
      userId: await createUser(),
      answers: original,
    });

    expect(id).toBeNull();
  });

  it("edits the latest submission when the form allows several", async () => {
    const { org, form, userId, submissionId, original } = await setup({
      allowMultipleSubmissions: true,
    });
    const latestId = await createFormSubmission(form, {
      userId,
      answers: original,
      submittedAt: new Date(Date.now() + 60_000),
    });
    const shortText = form.components.find(
      ({ type }) => type === FormComponentType.ShortText,
    )!;

    const id = await FormSubmissionService.updateMemberSubmission({
      form,
      organizationId: org.id,
      userId,
      answers: { ...original, [shortText.id]: "Changed" },
    });

    expect(id).toBe(latestId);
    expect((await answersOf(latestId))[shortText.id]).toBe("Changed");
    expect((await answersOf(submissionId))[shortText.id]).not.toBe("Changed");
  });

  it("doesn't touch another org's submission", async () => {
    const { form, userId, original } = await setup();
    const otherOrg = await createOrganization("other");

    const id = await FormSubmissionService.updateMemberSubmission({
      form,
      organizationId: otherOrg.id,
      userId,
      answers: original,
    });

    expect(id).toBeNull();
  });

  it("rejects an upload from another user and changes nothing", async () => {
    const { org, form, userId, submissionId, original } = await setup();
    const foreign = await createFormUpload(form, {
      uploadedBy: await createUser(),
    });
    const image = form.components.find(
      ({ type }) => type === FormComponentType.Image,
    )!;

    const error = await FormSubmissionService.updateMemberSubmission({
      form,
      organizationId: org.id,
      userId,
      answers: buildSampleAnswers(form, { uploadId: foreign }),
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(InvalidUploadError);
    expect((error as InvalidUploadError).componentId).toBe(image.id);
    expect(await answersOf(submissionId)).toEqual(original);
    const [row] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId));
    expect(row.updatedAt).toBeNull();
  });
});

describe("FormSubmissionService.getSubmissionDetail", () => {
  it("returns the submission with its form, answers, and submitter", async () => {
    const org = await createOrganization("acme");
    const { user } = await signUpAndGetSession(buildTestUser());
    const form = await createForm(org.id, { status: FormStatus.Published });
    const uploadId = await createFormUpload(form, { uploadedBy: user.id });
    const answers = buildSampleAnswers(form, { uploadId });
    const id = await createFormSubmission(form, {
      userId: user.id,
      answers,
      submittedAt: new Date("2027-01-01T00:00:00Z"),
      reviewStatus: SubmissionReviewStatus.UnderReview,
    });

    const detail = await FormSubmissionService.getSubmissionDetail(org.id, id);

    expect(detail).toEqual({
      submission: {
        id,
        userId: user.id,
        submittedAt: new Date("2027-01-01T00:00:00Z"),
        updatedAt: null,
        reviewStatus: SubmissionReviewStatus.UnderReview,
        reviewStatusUpdatedAt: null,
      },
      submitter: { id: user.id, name: user.name, email: user.email },
      definition: { ...form, organizationId: undefined },
      answers,
    });
  });

  it("has no submitter for a guest", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });
    const id = await createFormSubmission(form);

    const detail = await FormSubmissionService.getSubmissionDetail(org.id, id);
    expect(detail?.submitter).toBeNull();
    expect(detail?.answers).toEqual({});
  });

  it("returns null for another organization's submission", async () => {
    const orgA = await createOrganization("acme");
    const orgB = await createOrganization("globex");
    const form = await createForm(orgA.id, { status: FormStatus.Published });
    const id = await createFormSubmission(form);

    expect(
      await FormSubmissionService.getSubmissionDetail(orgB.id, id),
    ).toBeNull();
  });
});

describe("FormSubmissionService.getMemberSubmission", () => {
  it("returns the member's latest response to the form", async () => {
    const org = await createOrganization("acme");
    const userId = await createUser();
    const form = await createForm(org.id, {
      status: FormStatus.Published,
      settings: { allowMultipleSubmissions: true },
    });
    const name = form.components[1].id;
    await createFormSubmission(form, {
      userId,
      answers: { [name]: "First" },
      submittedAt: new Date("2027-01-01T00:00:00Z"),
    });
    const latest = await createFormSubmission(form, {
      userId,
      answers: { [name]: "Second" },
      submittedAt: new Date("2027-02-01T00:00:00Z"),
    });
    await createFormSubmission(form, {
      userId: await createUser(),
      answers: { [name]: "Someone else" },
      submittedAt: new Date("2027-03-01T00:00:00Z"),
    });

    const response = await FormSubmissionService.getMemberSubmission(
      org.id,
      form.formId,
      userId,
    );

    expect(response?.submission.id).toBe(latest);
    expect(response?.answers).toEqual({ [name]: "Second" });
  });

  it("returns null when the member hasn't responded", async () => {
    const org = await createOrganization("acme");
    const form = await createForm(org.id, { status: FormStatus.Published });
    expect(
      await FormSubmissionService.getMemberSubmission(
        org.id,
        form.formId,
        await createUser(),
      ),
    ).toBeNull();
  });

  it("doesn't find a form in another organization", async () => {
    const orgA = await createOrganization("acme");
    const orgB = await createOrganization("globex");
    const userId = await createUser();
    const form = await createForm(orgA.id, { status: FormStatus.Published });
    await createFormSubmission(form, { userId });

    expect(
      await FormSubmissionService.getMemberSubmission(
        orgB.id,
        form.formId,
        userId,
      ),
    ).toBeNull();
  });
});

describe("FormSubmissionService.getMemberUpload", () => {
  it("returns only the member's own upload to the org's form", async () => {
    const orgA = await createOrganization("acme");
    const orgB = await createOrganization("globex");
    const userId = await createUser();
    const form = await createForm(orgA.id, { status: FormStatus.Published });
    const uploadId = await createFormUpload(form, {
      uploadedBy: userId,
      fileName: "me.png",
    });

    expect(
      await FormSubmissionService.getMemberUpload(
        orgA.id,
        form.formId,
        uploadId,
        userId,
      ),
    ).toEqual({ fileName: "me.png", contentType: "image/png" });
    expect(
      await FormSubmissionService.getMemberUpload(
        orgA.id,
        form.formId,
        uploadId,
        await createUser(),
      ),
    ).toBeNull();
    expect(
      await FormSubmissionService.getMemberUpload(
        orgB.id,
        form.formId,
        uploadId,
        userId,
      ),
    ).toBeNull();
  });
});
