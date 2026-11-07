// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FormComponentType } from "@/features/forms/schema";
import {
  QuestionGroupConfigSchema,
  FORM_ANSWER_VALUE_SCHEMAS,
  type FormComponentOfType,
  type SubQuestion,
} from "@/features/forms/lib/schema";
import { buildSubmissionSchema } from "@/features/forms/lib/submission";
import {
  VISIONARIES_ATTENDEE_FORMS,
  buildSampleAnswers,
} from "@/tests/unit/fixtures/forms";

const sub: SubQuestion = {
  id: randomUUID(),
  type: FormComponentType.Phone,
  label: "Phone",
  required: true,
  config: {},
};
const group: FormComponentOfType<FormComponentType.QuestionGroup> = {
  id: randomUUID(),
  type: FormComponentType.QuestionGroup,
  label: "Contacts",
  helpText: null,
  required: true,
  position: 0,
  config: { questions: [sub], repeatable: true, minEntries: 2, maxEntries: 3 },
};
const entry = { [sub.id]: "(404) 555-0123" };
const schema = buildSubmissionSchema({ components: [group] });

describe("question group contract", () => {
  it("accepts groups and registers partial answers for drafts", () => {
    expect(QuestionGroupConfigSchema.parse(group.config)).toEqual(group.config);
    expect(
      FORM_ANSWER_VALUE_SCHEMAS.question_group.safeParse([{}, entry]).success,
    ).toBe(true);
  });
  it.each([
    FormComponentType.QuestionGroup,
    FormComponentType.Image,
    FormComponentType.SectionHeader,
  ])("rejects %s sub-questions", (type) => {
    expect(
      QuestionGroupConfigSchema.safeParse({
        ...group.config,
        questions: [{ ...sub, type }],
      }).success,
    ).toBe(false);
  });
  it.each([
    { questions: [] },
    {
      questions: Array.from({ length: 11 }, () => ({
        ...sub,
        id: randomUUID(),
      })),
    },
    { questions: [sub, sub] },
    { maxEntries: 21 },
    { minEntries: -1 },
    { minEntries: 4, maxEntries: 3 },
    { repeatable: false, minEntries: 2 },
    { addLabel: " " },
  ])("rejects invalid config %j", (config) => {
    expect(
      QuestionGroupConfigSchema.safeParse({ ...group.config, ...config })
        .success,
    ).toBe(false);
  });
  it("normalizes every entry using the sub-question's own rules", () => {
    expect(schema.parse({ [group.id]: [entry, entry] })).toEqual({
      [group.id]: [{ [sub.id]: "4045550123" }, { [sub.id]: "4045550123" }],
    });
  });
  it.each([
    undefined,
    [],
    [entry],
    [entry, entry, entry, entry],
    [entry, {}],
    [entry, { [sub.id]: "invalid" }],
    [entry, { ...entry, [randomUUID()]: "unknown" }],
  ])("rejects invalid answers %j", (answer) => {
    expect(schema.safeParse({ [group.id]: answer }).success).toBe(false);
  });
  it("requires an entry for a required group even when its minimum is zero", () => {
    const required = buildSubmissionSchema({
      components: [{ ...group, config: { ...group.config, minEntries: 0 } }],
    });
    expect(required.safeParse({ [group.id]: [] }).success).toBe(false);
  });
  it("allows no entries in an optional repeatable group", () => {
    const optional = buildSubmissionSchema({
      components: [
        {
          ...group,
          required: false,
          config: { ...group.config, minEntries: 0 },
        },
      ],
    });
    expect(optional.parse({ [group.id]: [] })).toEqual({ [group.id]: [] });
    expect(optional.parse({})).toEqual({});
  });
  it("accepts exactly one entry in a non-repeating group", () => {
    const single = buildSubmissionSchema({
      components: [
        { ...group, config: { questions: [sub], repeatable: false } },
      ],
    });
    expect(single.safeParse({ [group.id]: [entry] }).success).toBe(true);
    expect(single.safeParse({ [group.id]: [] }).success).toBe(false);
    expect(single.safeParse({ [group.id]: [entry, entry] }).success).toBe(
      false,
    );
  });
  it.each([
    [FormComponentType.ShortText, { maxLength: 3 }, "long"],
    [FormComponentType.LongText, { minWords: 2 }, "one"],
    [FormComponentType.Email, {}, "invalid"],
    [FormComponentType.Number, { integer: true, min: 1 }, 1.5],
    [FormComponentType.Dropdown, { options: ["A"] }, "B"],
    [FormComponentType.SingleChoice, { options: ["A"] }, "B"],
    [
      FormComponentType.Checkboxes,
      { options: ["A", "B"], maxSelected: 1 },
      ["A", "B"],
    ],
    [FormComponentType.Date, { min: "2027-01-01" }, "2026-01-01"],
    [FormComponentType.YesNo, {}, "yes"],
  ])("validates %s in every entry", (type, config, answer) => {
    const component = {
      ...group,
      config: { questions: [{ ...sub, type, config }], repeatable: false },
    } as typeof group;
    expect(
      buildSubmissionSchema({ components: [component] }).safeParse({
        [group.id]: [{ [sub.id]: answer }],
      }).success,
    ).toBe(false);
  });
  it("keeps the seeded emergency contacts and medical answers valid", () => {
    for (const form of VISIONARIES_ATTENDEE_FORMS)
      expect(
        buildSubmissionSchema(form).safeParse(buildSampleAnswers(form)).success,
      ).toBe(true);
  });
});
