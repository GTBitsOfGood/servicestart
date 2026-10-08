// @vitest-environment node
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  FormComponentType,
  FormStatus,
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
