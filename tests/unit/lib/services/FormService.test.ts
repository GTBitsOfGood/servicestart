// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import db from "@/lib/db";
import {
  formComponents,
  users,
  FormStatus,
  FormComponentType,
} from "@/lib/schema";
import { FormService } from "@/lib/services/FormService";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import {
  createOrganization,
  createForm,
  createFormSubmission,
  createFormUpload,
  createFormComponents,
  buildTestUser,
  signUpAndGetSession,
} from "@/tests/unit/testUtils";

const org = () => createOrganization(`forms-${randomUUID()}`);

describe("FormService", () => {
  it("creates empty drafts with shared defaults and validates IDs", async () => {
    const organization = await org();
    const actor = await signUpAndGetSession(buildTestUser());
    const form = await FormService.create(organization.id, actor.user.id, {
      title: " Application ",
      formId: "application",
    });
    expect(form).toMatchObject({
      title: "Application",
      status: FormStatus.Draft,
      settings: DEFAULT_FORM_SETTINGS,
    });
    for (const formId of ["", "Uppercase", "has spaces", "x".repeat(65)]) {
      await expect(
        FormService.create(organization.id, actor.user.id, {
          title: "Form",
          formId,
        }),
      ).rejects.toThrow();
    }
    await expect(
      FormService.get(organization.id, form.formId),
    ).resolves.toMatchObject({ id: form.id });
  });

  it("enforces uniqueness per org, including concurrent creates", async () => {
    const a = await org();
    const b = await org();
    const actor = await signUpAndGetSession(buildTestUser());
    const input = { title: "Application", formId: "same" };
    const results = await Promise.allSettled([
      FormService.create(a.id, actor.user.id, input),
      FormService.create(a.id, actor.user.id, input),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { reason: "conflict", field: "formId" } });
    await expect(
      FormService.create(b.id, actor.user.id, input),
    ).resolves.toMatchObject({ formId: "same" });
  });

  it("updates settings and draft slugs but rejects collisions and invalid dates", async () => {
    const a = await org();
    const form = await createForm(a.id);
    await createForm(a.id, { formId: "taken" });
    await expect(
      FormService.update(a.id, form.formId, { formId: "taken" }),
    ).rejects.toMatchObject({ reason: "conflict" });
    const updated = await FormService.update(a.id, form.formId, {
      title: "Updated",
      formId: "renamed",
      description: "About",
      settings: {
        ...DEFAULT_FORM_SETTINGS,
        requireLogin: false,
        allowMultipleSubmissions: true,
        opensAt: "2030-01-01T10:00:00Z",
        closesAt: "2030-01-02T10:00:00Z",
        confirmationMessage: "Done",
      },
    });
    expect(updated).toMatchObject({
      title: "Updated",
      description: "About",
      formId: "renamed",
      settings: { requireLogin: false, confirmationMessage: "Done" },
    });
    await expect(
      FormService.update(a.id, "renamed", {
        settings: {
          ...DEFAULT_FORM_SETTINGS,
          opensAt: "2030-01-03T10:00:00Z",
          closesAt: "2030-01-02T10:00:00Z",
        },
      }),
    ).rejects.toThrow();
    await FormService.transition(a.id, "renamed", "publish");
    await expect(
      FormService.update(a.id, "renamed", { formId: "again" }),
    ).rejects.toMatchObject({ reason: "conflict" });
    await expect(
      FormService.update(a.id, "renamed", { title: "Published title" }),
    ).resolves.toMatchObject({ title: "Published title" });
    await FormService.transition(a.id, "renamed", "close");
    await expect(
      FormService.update(a.id, "renamed", { formId: "again" }),
    ).rejects.toMatchObject({ reason: "conflict" });
  });

  it("counts answerable questions and responses independently and excludes archived questions", async () => {
    const a = await org();
    const b = await org();
    const form = await createForm(a.id);
    await createFormSubmission(form);
    await createFormSubmission(form);
    await db
      .update(formComponents)
      .set({ archivedAt: new Date() })
      .where(eq(formComponents.id, form.components[1].id));
    await createForm(b.id);
    expect(await FormService.list(a.id)).toMatchObject([
      { id: form.id, questionCount: 9, responseCount: 2 },
    ]);
  });

  it("rejects empty/section-only forms and names invalid question configs", async () => {
    const a = await org();
    const form = await createForm(a.id, { components: [] });
    await expect(
      FormService.transition(a.id, form.formId, "publish"),
    ).rejects.toThrow("at least one question");
    await createFormComponents(form, [
      {
        type: FormComponentType.SectionHeader,
        label: "Heading",
        helpText: null,
        required: false,
        config: {},
      },
    ]);
    await expect(
      FormService.transition(a.id, form.formId, "publish"),
    ).rejects.toThrow("at least one question");
    const invalid = await createForm(a.id, {
      components: [
        {
          type: FormComponentType.ShortText,
          label: "Student name",
          helpText: null,
          required: true,
          config: { maxLength: -1 },
        },
      ],
    });
    await expect(
      FormService.transition(a.id, invalid.formId, "publish"),
    ).rejects.toThrow("Student name:");
    expect((await FormService.get(a.id, invalid.formId)).status).toBe(
      FormStatus.Draft,
    );
  });

  it("publishes, closes, and reopens; rejects invalid and concurrent transitions", async () => {
    const a = await org();
    const form = await createForm(a.id);
    await expect(
      FormService.transition(a.id, form.formId, "close"),
    ).rejects.toMatchObject({ reason: "conflict" });
    await expect(
      FormService.transition(a.id, form.formId, "reopen"),
    ).rejects.toMatchObject({ reason: "conflict" });
    const results = await Promise.allSettled([
      FormService.transition(a.id, form.formId, "publish"),
      FormService.transition(a.id, form.formId, "publish"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    await expect(
      FormService.transition(a.id, form.formId, "close"),
    ).resolves.toMatchObject({ status: FormStatus.Closed });
    await expect(
      FormService.transition(a.id, form.formId, "publish"),
    ).rejects.toMatchObject({ reason: "conflict" });
    await expect(
      FormService.transition(a.id, form.formId, "reopen"),
    ).resolves.toMatchObject({ status: FormStatus.Published });
  });

  it("only deletes drafts without submissions", async () => {
    const a = await org();
    const draft = await createForm(a.id);
    await FormService.remove(a.id, draft.formId);
    await expect(FormService.get(a.id, draft.formId)).rejects.toMatchObject({
      reason: "not-found",
    });
    for (const status of [FormStatus.Published, FormStatus.Closed]) {
      const form = await createForm(a.id, { status });
      await expect(FormService.remove(a.id, form.formId)).rejects.toMatchObject(
        { reason: "conflict" },
      );
    }
    const withSubmission = await createForm(a.id);
    await createFormSubmission(withSubmission);
    await expect(
      FormService.remove(a.id, withSubmission.formId),
    ).rejects.toMatchObject({ reason: "conflict" });
  });

  it("scopes every operation to the organization", async () => {
    const a = await org();
    const b = await org();
    const form = await createForm(a.id);
    const uploadId = await createFormUpload(form);
    const operations = [
      () => FormService.get(b.id, form.formId),
      () => FormService.update(b.id, form.formId, { title: "Attack" }),
      () => FormService.remove(b.id, form.formId),
      () => FormService.exportCsv(b.id, form.formId, "https://example.com"),
      () => FormService.getUpload(b.id, form.formId, uploadId),
      ...(["publish", "close", "reopen"] as const).map(
        (action) => () => FormService.transition(b.id, form.formId, action),
      ),
    ];
    for (const operation of operations)
      await expect(operation()).rejects.toMatchObject({ reason: "not-found" });
    expect(await FormService.list(b.id)).toEqual([]);
    const other = await createForm(a.id);
    await expect(
      FormService.getUpload(a.id, other.formId, uploadId),
    ).rejects.toMatchObject({ reason: "not-found" });
  });

  it("exports ordered columns, escaped cells, images, missing answers and anonymous responses", async () => {
    const a = await org();
    const form = await createForm(a.id, {
      components: [
        {
          type: FormComponentType.SectionHeader,
          label: "Skip heading",
          helpText: null,
          required: false,
          config: {},
        },
        {
          type: FormComponentType.ShortText,
          label: "=Name",
          helpText: null,
          required: true,
          config: {},
        },
        {
          type: FormComponentType.Image,
          label: "Headshot",
          helpText: null,
          required: false,
          config: {},
        },
        {
          type: FormComponentType.ShortText,
          label: "Optional",
          helpText: null,
          required: false,
          config: {},
        },
      ],
    });
    const uploadId = await createFormUpload(form);
    await createFormSubmission(form, {
      submittedAt: new Date("2030-01-01T12:00:00Z"),
      answers: {
        [form.components[1].id]: '+Hello, "world"\nnext',
        [form.components[2].id]: { uploadId },
      },
    });
    const csv = await FormService.exportCsv(
      a.id,
      form.formId,
      "https://tenant.example",
    );
    expect(csv).toBe(
      `"Submitter name","Submitter email","Submitted at","'=Name","Headshot","Optional"\r\n"","","2030-01-01T12:00:00.000Z","'+Hello, ""world""\nnext","https://tenant.example/api/forms/${form.formId}/uploads/${uploadId}",""\r\n`,
    );
    await db
      .update(formComponents)
      .set({ position: 99 })
      .where(eq(formComponents.id, form.components[1].id));
    expect(
      (
        await FormService.exportCsv(a.id, form.formId, "https://tenant.example")
      ).split("\r\n")[0],
    ).toContain('"Headshot","Optional","\'=Name"');
  });

  it("exports submitter identity and retains responses after user deletion", async () => {
    const a = await org();
    const { user } = await signUpAndGetSession(buildTestUser());
    const form = await createForm(a.id);
    await createFormSubmission(form, { userId: user.id });
    expect(
      await FormService.exportCsv(a.id, form.formId, "https://example.com"),
    ).toContain(`"${user.name}","${user.email}"`);
    await db
      .delete(users)
      .where(and(eq(users.id, user.id), eq(users.organizationId, a.id)));
    expect(
      (
        await FormService.exportCsv(a.id, form.formId, "https://example.com")
      ).split("\r\n")[1],
    ).toMatch(/^"","","/);
  });
});
