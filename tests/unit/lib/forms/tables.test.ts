// @vitest-environment node
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import db from "@/lib/db";
import {
  formAnswers,
  formComponents,
  forms,
  formSubmissions,
  formUploads,
  FormComponentType,
  FormStatus,
  organizations,
  users,
} from "@/lib/schema";
import { FormDefinitionSchema } from "@/lib/forms/schema";
import {
  buildSampleAnswers,
  buildTestUser,
  createForm,
  createFormSubmission,
  createFormUpload,
  createOrganization,
  signUpAndGetSession,
  VISIONARIES_APPLICATION_FORM,
} from "@/tests/unit/testUtils";

describe(createForm, () => {
  it("creates a draft copy of the Visionaries application with new IDs", async () => {
    const org = await createOrganization("forms-default");

    const form = await createForm(org.id);

    expect(FormDefinitionSchema.parse(form)).toBeTruthy();
    expect(form.status).toBe(FormStatus.Draft);
    expect(form.id).not.toBe(VISIONARIES_APPLICATION_FORM.id);
    expect(
      form.components.map(({ type, label, position }) => [
        type,
        label,
        position,
      ]),
    ).toEqual(
      VISIONARIES_APPLICATION_FORM.components.map(
        ({ type, label, position }) => [type, label, position],
      ),
    );
    const fixtureIds = VISIONARIES_APPLICATION_FORM.components.map((c) => c.id);
    expect(form.components.some((c) => fixtureIds.includes(c.id))).toBe(false);
  });

  it("creates a form in any status with the given components", async () => {
    const org = await createOrganization("forms-custom");

    const form = await createForm(org.id, {
      formId: "volunteer-signup",
      status: FormStatus.Closed,
      settings: { allowMultipleSubmissions: true },
      components: [
        {
          type: FormComponentType.Number,
          label: "Age",
          helpText: null,
          required: true,
          config: { min: 13, integer: true },
        },
      ],
    });

    const [stored] = await db.select().from(forms).where(eq(forms.id, form.id));
    expect(stored.status).toBe(FormStatus.Closed);
    expect(stored.settings.allowMultipleSubmissions).toBe(true);
    expect(stored.settings.requireLogin).toBe(true);
    expect(form.components).toHaveLength(1);
    expect(form.components[0].config).toEqual({ min: 13, integer: true });
  });

  it("creates a form with no questions", async () => {
    const org = await createOrganization("forms-empty");

    const form = await createForm(org.id, { components: [] });

    expect(form.components).toEqual([]);
  });
});

describe("forms tables", () => {
  it("lets two organizations use the same form ID, but not one organization twice", async () => {
    const orgA = await createOrganization("forms-id-a");
    const orgB = await createOrganization("forms-id-b");

    await createForm(orgA.id, { formId: "camp-application-2027" });
    await createForm(orgB.id, { formId: "camp-application-2027" });

    await expect(
      createForm(orgA.id, { formId: "camp-application-2027" }),
    ).rejects.toThrow();
  });

  it("stores a submission's answers once per question", async () => {
    const org = await createOrganization("forms-answers");
    const { user } = await signUpAndGetSession(buildTestUser());
    const form = await createForm(org.id, { status: FormStatus.Published });
    const uploadId = await createFormUpload(form, { uploadedBy: user.id });
    const answers = buildSampleAnswers(form, { uploadId });

    const submissionId = await createFormSubmission(form, {
      userId: user.id,
      answers,
    });

    const stored = await db
      .select()
      .from(formAnswers)
      .where(eq(formAnswers.submissionId, submissionId));
    expect(
      Object.fromEntries(stored.map((a) => [a.componentId, a.value])),
    ).toEqual(answers);
    // Every question except the two section headers.
    expect(stored).toHaveLength(form.components.length - 2);

    const [componentId] = Object.keys(answers);
    await expect(
      db
        .insert(formAnswers)
        .values({ formId: form.id, submissionId, componentId, value: "Again" }),
    ).rejects.toThrow();
  });

  it("won't store an answer to another form's question", async () => {
    const org = await createOrganization("forms-cross-form");
    const form = await createForm(org.id);
    const otherForm = await createForm(org.id);
    const [, otherQuestion] = otherForm.components;

    await expect(
      createFormSubmission(form, {
        answers: { [otherQuestion.id]: "Sample answer" },
      }),
    ).rejects.toThrow();
    // Claiming the other form's ID doesn't help: the submission isn't on it.
    const submissionId = await createFormSubmission(form);
    await expect(
      db.insert(formAnswers).values({
        formId: otherForm.id,
        submissionId,
        componentId: otherQuestion.id,
        value: "Sample answer",
      }),
    ).rejects.toThrow();
    // The failed helper call left no submission behind.
    expect(
      await db
        .select()
        .from(formSubmissions)
        .where(eq(formSubmissions.formId, form.id)),
    ).toHaveLength(1);
  });

  it("keeps responses and uploads when the user's account is deleted", async () => {
    const org = await createOrganization("forms-user-deleted");
    const { user } = await signUpAndGetSession(buildTestUser());
    const form = await createForm(org.id, { status: FormStatus.Published });
    const uploadId = await createFormUpload(form, { uploadedBy: user.id });
    const submissionId = await createFormSubmission(form, {
      userId: user.id,
      answers: buildSampleAnswers(form, { uploadId }),
    });

    await db.delete(users).where(eq(users.id, user.id));

    const [submission] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId));
    const [upload] = await db
      .select()
      .from(formUploads)
      .where(eq(formUploads.id, uploadId));
    expect(submission.userId).toBeNull();
    expect(upload.uploadedBy).toBeNull();
    expect(
      await db
        .select()
        .from(formAnswers)
        .where(eq(formAnswers.submissionId, submissionId)),
    ).toHaveLength(form.components.length - 2);
  });

  it("stores anonymous submissions and uploads", async () => {
    const org = await createOrganization("forms-anon");
    const form = await createForm(org.id, {
      settings: { requireLogin: false },
    });

    const uploadId = await createFormUpload(form);
    const submissionId = await createFormSubmission(form);

    const [upload] = await db
      .select()
      .from(formUploads)
      .where(eq(formUploads.id, uploadId));
    const [submission] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId));
    expect(upload.uploadedBy).toBeNull();
    expect(submission.userId).toBeNull();
  });

  it("reads back string answers that look like other JSON as strings", async () => {
    const org = await createOrganization("forms-json-strings");
    const form = await createForm(org.id, {
      components: ["7", "007", "true", "null", "4045550123", '{"a":1}'].map(
        (label) => ({
          type: FormComponentType.ShortText,
          label,
          helpText: null,
          required: true,
          config: {},
        }),
      ),
    });
    const answers = Object.fromEntries(
      form.components.map((component) => [component.id, component.label]),
    );

    const submissionId = await createFormSubmission(form, { answers });

    const selected = await db
      .select()
      .from(formAnswers)
      .where(eq(formAnswers.submissionId, submissionId));
    expect(
      Object.fromEntries(selected.map((a) => [a.componentId, a.value])),
    ).toEqual(answers);
    const queried = await db.query.formSubmissions.findFirst({
      where: { id: submissionId },
      with: { answers: true },
    });
    expect(
      Object.fromEntries(queried!.answers.map((a) => [a.componentId, a.value])),
    ).toEqual(answers);
  });

  it("removes forms and their responses with the organization", async () => {
    const org = await createOrganization("forms-cascade");
    const form = await createForm(org.id);
    const uploadId = await createFormUpload(form);
    await createFormSubmission(form, {
      answers: buildSampleAnswers(form, { uploadId }),
    });

    await db.delete(organizations).where(eq(organizations.id, org.id));

    expect(await db.select().from(forms)).toHaveLength(0);
    expect(await db.select().from(formComponents)).toHaveLength(0);
    expect(await db.select().from(formSubmissions)).toHaveLength(0);
    expect(await db.select().from(formAnswers)).toHaveLength(0);
    expect(await db.select().from(formUploads)).toHaveLength(0);
  });
});
