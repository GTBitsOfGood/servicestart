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
} from "@/lib/schema";
import {
  DuplicateSubmissionError,
  FormSubmissionService,
  InvalidUploadError,
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
    expect(await FormSubmissionService.hasSubmitted(form.id, userId)).toBe(
      true,
    );
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
