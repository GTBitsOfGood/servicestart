// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { FormQuestionService } from "@/lib/services/FormQuestionService";
import {
  FormComponentType,
  FormStatus,
  OrganizationConfigKey,
} from "@/lib/schema";
import type { FormQuestionInput as QuestionInput } from "@/lib/forms/schema";
import {
  addMember,
  buildTestUser,
  createForm,
  createOrganization,
  type NewFormComponent,
  setActiveOrganization,
  signUpAndGetSession,
  testApi,
} from "@/tests/unit/testUtils";

async function setup(role = "admin", enabled = true) {
  const org = await createOrganization(`form-questions-${randomUUID()}`);
  const { user, session, headers } = await signUpAndGetSession(buildTestUser());
  await addMember(user.id, org.id, role);
  await setActiveOrganization(session.id, org.id);
  await OrganizationConfigService.setConfig(
    org.id,
    OrganizationConfigKey.FormsEnabled,
    String(enabled),
  );
  return { org, user, headers };
}

const route = testApi.forms[":formId"].questions;

const shortText = (label: string, extra: Partial<QuestionInput> = {}) =>
  ({
    type: FormComponentType.ShortText,
    label,
    helpText: null,
    required: false,
    config: {},
    ...extra,
  }) as QuestionInput;

const component = (label: string): NewFormComponent => ({
  type: FormComponentType.ShortText,
  label,
  helpText: null,
  required: false,
  config: {},
});

async function save(
  headers: Record<string, string>,
  formId: string,
  questions: QuestionInput[],
) {
  return route.$put({ param: { formId }, json: { questions } }, { headers });
}

async function load(headers: Record<string, string>, formId: string) {
  const response = await route.$get({ param: { formId } }, { headers });
  expect(response.status).toBe(200);
  return response.json();
}

describe("form questions API", () => {
  it("returns the form's title, status, and questions in order", async () => {
    const { org, headers } = await setup();
    const form = await createForm(org.id, {
      title: "Camp form",
      components: [component("First"), component("Second")],
    });
    expect(await load(headers, form.formId)).toEqual({
      formId: form.formId,
      title: "Camp form",
      status: FormStatus.Draft,
      questions: form.components,
    });
  });

  it("saves questions and keeps their order on reload", async () => {
    const { org, headers } = await setup();
    const form = await createForm(org.id, { components: [] });
    const response = await save(headers, form.formId, [
      shortText("C"),
      shortText("A"),
      shortText("B"),
    ]);
    expect(response.status).toBe(200);
    const { questions } = await load(headers, form.formId);
    expect(questions.map(({ label, position }) => [label, position])).toEqual([
      ["C", 0],
      ["A", 1],
      ["B", 2],
    ]);
  });

  it("adds, edits, removes, and reorders questions in one save", async () => {
    const { org, headers } = await setup();
    const form = await createForm(org.id, {
      components: [component("Keep"), component("Remove"), component("Edit")],
    });
    const [keep, , edit] = form.components;
    const response = await save(headers, form.formId, [
      {
        id: edit.id,
        type: FormComponentType.SingleChoice,
        label: "Edited",
        helpText: "  ",
        required: true,
        config: { options: ["Red", "Blue"] },
      },
      { id: keep.id, ...shortText("Keep") },
      {
        type: FormComponentType.Date,
        label: "Added",
        helpText: "When?",
        required: false,
        config: { min: "2027-06-01" },
      },
    ]);
    expect(response.status).toBe(200);
    const { questions } = await load(headers, form.formId);
    expect(questions).toEqual([
      {
        id: edit.id,
        type: FormComponentType.SingleChoice,
        label: "Edited",
        helpText: null,
        required: true,
        position: 0,
        config: { options: ["Red", "Blue"] },
      },
      { ...keep, position: 1 },
      {
        id: expect.any(String),
        type: FormComponentType.Date,
        label: "Added",
        helpText: "When?",
        required: false,
        position: 2,
        config: { min: "2027-06-01" },
      },
    ]);
  });

  it.each<[string, QuestionInput]>([
    [
      "short text",
      { ...shortText("Q"), config: { maxLength: 0 } } as QuestionInput,
    ],
    [
      "long text",
      {
        type: FormComponentType.LongText,
        label: "Q",
        helpText: null,
        required: false,
        config: { minWords: 10, maxWords: 5 },
      },
    ],
    [
      "number",
      {
        type: FormComponentType.Number,
        label: "Q",
        helpText: null,
        required: false,
        config: { min: 5, max: 1 },
      },
    ],
    [
      "single choice",
      {
        type: FormComponentType.SingleChoice,
        label: "Q",
        helpText: null,
        required: false,
        config: { options: ["Same", "Same"] },
      },
    ],
    [
      "dropdown",
      {
        type: FormComponentType.Dropdown,
        label: "Q",
        helpText: null,
        required: false,
        config: { options: [] },
      },
    ],
    [
      "checkboxes",
      {
        type: FormComponentType.Checkboxes,
        label: "Q",
        helpText: null,
        required: false,
        config: { options: ["A", "B"], minSelected: 3 },
      },
    ],
    [
      "date",
      {
        type: FormComponentType.Date,
        label: "Q",
        helpText: null,
        required: false,
        config: { min: "2027-06-02", max: "2027-06-01" },
      },
    ],
    [
      "yes/no with settings",
      {
        type: FormComponentType.YesNo,
        label: "Q",
        helpText: null,
        required: false,
        config: { options: ["Yes"] },
      } as unknown as QuestionInput,
    ],
    ["a blank label", shortText("  ")],
  ])("rejects an invalid %s question", async (_, question) => {
    const { org, headers } = await setup();
    const form = await createForm(org.id, {
      components: [component("Original")],
    });
    const response = await save(headers, form.formId, [question]);
    expect(response.status).toBe(400);
    // Nothing changed.
    expect((await load(headers, form.formId)).questions).toEqual(
      form.components,
    );
  });

  it("rejects the same question ID twice in one save", async () => {
    const { org, headers } = await setup();
    const form = await createForm(org.id, {
      components: [component("Original")],
    });
    const { id } = form.components[0];
    const response = await save(headers, form.formId, [
      { id, ...shortText("One") },
      { id, ...shortText("Two") },
    ]);
    expect(response.status).toBe(400);
  });

  it("returns 409 when saving a published or closed form", async () => {
    const { org, headers } = await setup();
    for (const status of [FormStatus.Published, FormStatus.Closed]) {
      const form = await createForm(org.id, {
        status,
        components: [component("Locked")],
      });
      const response = await save(headers, form.formId, []);
      expect(response.status).toBe(409);
      expect((await load(headers, form.formId)).questions).toHaveLength(1);
    }
  });

  it("returns 404 for a missing form", async () => {
    const { headers } = await setup();
    expect(
      (await route.$get({ param: { formId: "missing" } }, { headers })).status,
    ).toBe(404);
    expect((await save(headers, "missing", [])).status).toBe(404);
  });

  it("returns 404 when forms are off", async () => {
    const { org, headers } = await setup("admin", false);
    const form = await createForm(org.id, { components: [] });
    expect(
      (await route.$get({ param: { formId: form.formId } }, { headers }))
        .status,
    ).toBe(404);
    expect((await save(headers, form.formId, [])).status).toBe(404);
  });

  it("rejects members and signed-out requests", async () => {
    const { org, headers } = await setup("member");
    const form = await createForm(org.id, { components: [] });
    expect(
      (await route.$get({ param: { formId: form.formId } }, { headers }))
        .status,
    ).toBe(403);
    expect((await save(headers, form.formId, [])).status).toBe(403);
    expect((await route.$get({ param: { formId: form.formId } })).status).toBe(
      401,
    );
  });

  it("keeps each organization's questions separate", async () => {
    const a = await setup();
    const b = await setup();
    const formA = await createForm(a.org.id, {
      formId: "shared-id",
      components: [component("Org A question")],
    });
    const formB = await createForm(b.org.id, {
      formId: "shared-id",
      components: [component("Org B question")],
    });

    // Org B's admin sees only its own form under the same form ID.
    expect((await load(b.headers, "shared-id")).questions).toEqual(
      formB.components,
    );
    // Org B can't save org A's question IDs into its own form.
    const response = await save(b.headers, "shared-id", [
      { id: formA.components[0].id, ...shortText("Stolen") },
    ]);
    expect(response.status).toBe(400);
    // A form only in org A is missing for org B.
    const onlyA = await createForm(a.org.id, { components: [] });
    expect(
      (
        await route.$get(
          { param: { formId: onlyA.formId } },
          { headers: b.headers },
        )
      ).status,
    ).toBe(404);
    expect((await save(b.headers, onlyA.formId, [])).status).toBe(404);
    // Org A's questions are untouched.
    expect((await load(a.headers, "shared-id")).questions).toEqual(
      formA.components,
    );
  });

  it("rejects a question ID from another form in the same organization", async () => {
    const { org, headers } = await setup();
    const other = await createForm(org.id, {
      components: [component("Other form")],
    });
    const form = await createForm(org.id, { components: [] });
    const response = await save(headers, form.formId, [
      { id: other.components[0].id, ...shortText("Moved") },
    ]);
    expect(response.status).toBe(400);
    expect(
      (await FormQuestionService.get(org.id, other.formId)).questions,
    ).toEqual(other.components);
  });
});
