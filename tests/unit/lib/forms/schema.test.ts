// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FormComponentType, MemberType } from "@/lib/schema";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import {
  FORM_ANSWER_VALUE_SCHEMAS,
  FORM_COMPONENT_CONFIG_SCHEMAS,
  FormComponentConfigSchema,
  FormComponentSchema,
  FormDefinitionSchema,
  FormIdSchema,
  FormSettingsSchema,
  FormSubmissionPayloadSchema,
  getAcceptedMemberType,
  getAssignedMemberTypes,
  getDueAt,
  isImageAnswer,
} from "@/lib/forms/schema";
import { VISIONARIES_APPLICATION_FORM } from "@/tests/unit/fixtures/forms";

const UPLOAD_ID = "3b0f6a52-8c1d-4e7a-9f20-6d5c4b3a2910";

// Every type needs at least one valid and one invalid example of each.
const CONFIG_EXAMPLES: Record<
  FormComponentType,
  { valid: unknown[]; invalid: unknown[] }
> = {
  [FormComponentType.ShortText]: {
    valid: [{}, { maxLength: 100 }],
    invalid: [{ maxLength: 0 }, { maxLength: 2.5 }, { minWords: 1 }],
  },
  [FormComponentType.LongText]: {
    valid: [{}, { minWords: 100, maxWords: 150 }, { maxWords: 10 }],
    invalid: [
      { minWords: 150, maxWords: 100 },
      { minWords: -1 },
      { maxLength: 10 },
    ],
  },
  [FormComponentType.Email]: {
    valid: [{}],
    invalid: [{ maxLength: 10 }],
  },
  [FormComponentType.Phone]: {
    valid: [{}],
    invalid: [{ country: "US" }],
  },
  [FormComponentType.Number]: {
    valid: [{}, { min: 1, max: 12, integer: true }, { min: -2.5 }],
    invalid: [{ min: 12, max: 1 }, { integer: "yes" }, { maxLength: 3 }],
  },
  [FormComponentType.Image]: {
    valid: [{}],
    invalid: [{ maxSizeBytes: 1024 }],
  },
  [FormComponentType.SectionHeader]: {
    valid: [{}],
    invalid: [{ level: 2 }],
  },
  [FormComponentType.SingleChoice]: {
    valid: [{ options: ["Small", "Medium", "Large"] }, { options: ["Only"] }],
    invalid: [
      {},
      { options: [] },
      { options: ["Same", "Same"] },
      { options: ["  "] },
      { options: Array.from({ length: 51 }, (_, i) => `Option ${i}`) },
    ],
  },
  [FormComponentType.Checkboxes]: {
    valid: [
      { options: ["Mon", "Wed", "Fri"] },
      { options: ["Mon", "Wed", "Fri"], minSelected: 1, maxSelected: 2 },
    ],
    invalid: [
      { options: ["Mon"], minSelected: 2 },
      { options: ["Mon", "Wed"], minSelected: 2, maxSelected: 1 },
      { options: ["Mon"], maxSelected: 0 },
      { minSelected: 1 },
    ],
  },
  [FormComponentType.Dropdown]: {
    valid: [{ options: ["Georgia", "Alabama"] }],
    invalid: [{ options: [] }, { options: ["GA"], multiple: true }],
  },
  [FormComponentType.Date]: {
    valid: [
      {},
      { min: "2027-06-02", max: "2027-08-20" },
      { max: "2027-01-01" },
    ],
    invalid: [
      { min: "2027-08-20", max: "2027-06-02" },
      { min: "06/02/2027" },
      { min: "2027-06-02T00:00:00Z" },
    ],
  },
  [FormComponentType.YesNo]: {
    valid: [{}],
    invalid: [{ options: ["Yes", "No"] }],
  },
};

const ANSWER_EXAMPLES: Record<
  FormComponentType,
  { valid: unknown[]; invalid: unknown[] }
> = {
  [FormComponentType.ShortText]: {
    valid: ["Ada Lovelace", "007", ""],
    invalid: [7, null, { uploadId: UPLOAD_ID }],
  },
  [FormComponentType.LongText]: {
    valid: ["Because I love to learn."],
    invalid: [42, ["a", "b"]],
  },
  [FormComponentType.Email]: {
    valid: ["student@example.com"],
    invalid: [42, { email: "student@example.com" }],
  },
  [FormComponentType.Phone]: {
    valid: ["4045550123", "(404) 555-0123"],
    invalid: [4045550123, null],
  },
  [FormComponentType.Number]: {
    valid: [9, 0, -1.5],
    invalid: ["9", Number.NaN, Number.POSITIVE_INFINITY],
  },
  [FormComponentType.Image]: {
    valid: [{ uploadId: UPLOAD_ID }],
    invalid: [
      UPLOAD_ID,
      { uploadId: "not-a-uuid" },
      { uploadId: UPLOAD_ID, url: "https://example.com/a.png" },
      {},
    ],
  },
  [FormComponentType.SectionHeader]: {
    valid: [],
    invalid: ["Contact Information", null, undefined, {}],
  },
  [FormComponentType.SingleChoice]: {
    valid: ["Medium"],
    invalid: [["Medium"], 1, true],
  },
  [FormComponentType.Checkboxes]: {
    valid: [["Mon", "Wed"], []],
    invalid: ["Mon", [1], { 0: "Mon" }],
  },
  [FormComponentType.Dropdown]: {
    valid: ["Georgia"],
    invalid: [["Georgia"], null],
  },
  [FormComponentType.Date]: {
    valid: ["2027-06-02"],
    invalid: [20270602, new Date("2027-06-02")],
  },
  [FormComponentType.YesNo]: {
    valid: [true, false],
    invalid: ["yes", 1, null],
  },
};

describe("component config schemas", () => {
  describe.each(Object.values(FormComponentType))("%s", (type) => {
    const valid = CONFIG_EXAMPLES[type].valid.map((config) => ({ config }));
    const invalid = CONFIG_EXAMPLES[type].invalid.map((config) => ({ config }));

    it.each(valid)("accepts $config", ({ config }) => {
      expect(
        FORM_COMPONENT_CONFIG_SCHEMAS[type].safeParse(config).success,
      ).toBe(true);
      expect(
        FormComponentConfigSchema.safeParse({ type, config }).success,
      ).toBe(true);
    });

    it.each(invalid)("rejects $config", ({ config }) => {
      expect(
        FORM_COMPONENT_CONFIG_SCHEMAS[type].safeParse(config).success,
      ).toBe(false);
      expect(
        FormComponentConfigSchema.safeParse({ type, config }).success,
      ).toBe(false);
    });
  });

  it("checks the config against the type it's paired with", () => {
    expect(
      FormComponentConfigSchema.safeParse({
        type: FormComponentType.Email,
        config: { maxLength: 10 },
      }).success,
    ).toBe(false);
    expect(
      FormComponentConfigSchema.safeParse({
        type: FormComponentType.ShortText,
        config: { maxLength: 10 },
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown type", () => {
    expect(
      FormComponentConfigSchema.safeParse({ type: "signature", config: {} })
        .success,
    ).toBe(false);
  });
});

describe("answer value schemas", () => {
  describe.each(Object.values(FormComponentType))("%s", (type) => {
    // Wrapped, so it.each doesn't spread list answers into arguments.
    const valid = ANSWER_EXAMPLES[type].valid.map((value) => ({ value }));
    const invalid = ANSWER_EXAMPLES[type].invalid.map((value) => ({ value }));

    it.each(valid)("accepts $value", ({ value }) => {
      expect(FORM_ANSWER_VALUE_SCHEMAS[type].safeParse(value).success).toBe(
        true,
      );
    });

    it.each(invalid)("rejects $value", ({ value }) => {
      expect(FORM_ANSWER_VALUE_SCHEMAS[type].safeParse(value).success).toBe(
        false,
      );
    });
  });
});

describe("FormComponentSchema", () => {
  const base = {
    id: "8a6e0f4c-2b1d-4c3e-9f5a-7b6c5d4e3f21",
    label: "Student Name",
    helpText: null,
    required: true,
    position: 0,
  };

  it("accepts a component with a matching config", () => {
    const component = {
      ...base,
      type: FormComponentType.ShortText,
      config: { maxLength: 50 },
    };
    expect(FormComponentSchema.parse(component)).toEqual(component);
  });

  it("rejects an empty label", () => {
    expect(
      FormComponentSchema.safeParse({
        ...base,
        label: "  ",
        type: FormComponentType.ShortText,
        config: {},
      }).success,
    ).toBe(false);
  });

  it("rejects a non-UUID ID", () => {
    expect(
      FormComponentSchema.safeParse({
        ...base,
        id: "question-1",
        type: FormComponentType.ShortText,
        config: {},
      }).success,
    ).toBe(false);
  });
});

describe("FormSettingsSchema", () => {
  it("accepts the defaults", () => {
    expect(FormSettingsSchema.parse(DEFAULT_FORM_SETTINGS)).toEqual(
      DEFAULT_FORM_SETTINGS,
    );
  });

  it("accepts an open and close window", () => {
    expect(
      FormSettingsSchema.safeParse({
        ...DEFAULT_FORM_SETTINGS,
        opensAt: "2027-03-01T00:00:00Z",
        closesAt: "2027-05-01T04:00:00-04:00",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown settings", () => {
    expect(
      FormSettingsSchema.safeParse({
        ...DEFAULT_FORM_SETTINGS,
        requireLogIn: false,
      }).success,
    ).toBe(false);
  });

  it("rejects a close time before the open time", () => {
    expect(
      FormSettingsSchema.safeParse({
        ...DEFAULT_FORM_SETTINGS,
        opensAt: "2027-05-01T00:00:00Z",
        closesAt: "2027-03-01T00:00:00Z",
      }).success,
    ).toBe(false);
  });

  it("rejects times that aren't ISO datetimes", () => {
    expect(
      FormSettingsSchema.safeParse({
        ...DEFAULT_FORM_SETTINGS,
        opensAt: "next Tuesday",
      }).success,
    ).toBe(false);
  });

  it("accepts forms saved before the Sprint 4 settings", () => {
    const old = {
      requireLogin: true,
      allowMultipleSubmissions: false,
      opensAt: null,
      closesAt: null,
      confirmationMessage: "Thanks!",
    };
    const settings = FormSettingsSchema.parse(old);
    expect(getAssignedMemberTypes(settings)).toEqual([]);
    expect(getDueAt(settings)).toBeNull();
    expect(getAcceptedMemberType(settings)).toBeNull();
  });

  it("accepts assigned member types, a due date, and an accepted type", () => {
    const settings = FormSettingsSchema.parse({
      ...DEFAULT_FORM_SETTINGS,
      assignedMemberTypes: [MemberType.Applicant],
      dueAt: "2027-04-01T04:00:00Z",
      acceptedMemberType: MemberType.Attendee,
    });
    expect(getAssignedMemberTypes(settings)).toEqual([MemberType.Applicant]);
    expect(getDueAt(settings)).toBe("2027-04-01T04:00:00Z");
    expect(getAcceptedMemberType(settings)).toBe(MemberType.Attendee);
  });

  it.each([
    ["an unknown member type", { assignedMemberTypes: ["camper"] }],
    [
      "a repeated member type",
      { assignedMemberTypes: [MemberType.Applicant, MemberType.Applicant] },
    ],
    ["a due date that isn't a datetime", { dueAt: "April 1" }],
    ["an unknown accepted type", { acceptedMemberType: "admin" }],
  ])("rejects %s", (_, settings) => {
    expect(
      FormSettingsSchema.safeParse({ ...DEFAULT_FORM_SETTINGS, ...settings })
        .success,
    ).toBe(false);
  });

  it("rejects an empty confirmation message", () => {
    expect(
      FormSettingsSchema.safeParse({
        ...DEFAULT_FORM_SETTINGS,
        confirmationMessage: "",
      }).success,
    ).toBe(false);
  });
});

describe("FormIdSchema", () => {
  it.each(["camp-application-2027", "a", "x".repeat(64)])(
    "accepts %s",
    (id) => {
      expect(FormIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each([
    "",
    "Camp-Application",
    "camp application",
    "camp_2027",
    "x".repeat(65),
  ])("rejects %j", (id) => {
    expect(FormIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("FormDefinitionSchema", () => {
  it("parses the Visionaries application fixture", () => {
    expect(FormDefinitionSchema.parse(VISIONARIES_APPLICATION_FORM)).toEqual(
      VISIONARIES_APPLICATION_FORM,
    );
  });

  it("has the Visionaries application questions in order", () => {
    expect(
      VISIONARIES_APPLICATION_FORM.components.map(
        ({ type, label, required }) => [type, label, required],
      ),
    ).toEqual([
      [FormComponentType.SectionHeader, "Contact Information", false],
      [FormComponentType.ShortText, "Student Name", true],
      [FormComponentType.ShortText, "Student Number", false],
      [FormComponentType.Email, "Student Email", true],
      [FormComponentType.ShortText, "Parent Name", true],
      [FormComponentType.Phone, "Parent Phone Number", true],
      [FormComponentType.Email, "Parent Email", true],
      [FormComponentType.SectionHeader, "Eligibility & Background", false],
      [
        FormComponentType.Number,
        "What grade will the student be headed to during Summer 2027?",
        true,
      ],
      [
        FormComponentType.ShortText,
        "Does the camper currently take any medication? (Write N/A if none.)",
        true,
      ],
      [
        FormComponentType.LongText,
        "Why would you like to be a part of this camp?",
        true,
      ],
      [FormComponentType.Image, "Headshot", true],
    ]);
  });

  it("rejects components out of position order", () => {
    const [first, second, ...rest] = VISIONARIES_APPLICATION_FORM.components;
    expect(
      FormDefinitionSchema.safeParse({
        ...VISIONARIES_APPLICATION_FORM,
        components: [second, first, ...rest],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate component IDs", () => {
    const [first, second, ...rest] = VISIONARIES_APPLICATION_FORM.components;
    expect(
      FormDefinitionSchema.safeParse({
        ...VISIONARIES_APPLICATION_FORM,
        components: [first, { ...second, id: first.id }, ...rest],
      }).success,
    ).toBe(false);
  });

  it("rejects a component whose config doesn't match its type", () => {
    const [header, ...rest] = VISIONARIES_APPLICATION_FORM.components;
    expect(
      FormDefinitionSchema.safeParse({
        ...VISIONARIES_APPLICATION_FORM,
        components: [{ ...header, config: { maxLength: 5 } }, ...rest],
      }).success,
    ).toBe(false);
  });
});

describe("FormSubmissionPayloadSchema", () => {
  const [, studentName, , , , , , , grade] =
    VISIONARIES_APPLICATION_FORM.components;

  it("accepts answers keyed by component ID", () => {
    const payload = {
      answers: {
        [studentName.id]: "Ada Lovelace",
        [grade.id]: 9,
        [UPLOAD_ID]: { uploadId: UPLOAD_ID },
      },
    };
    expect(FormSubmissionPayloadSchema.parse(payload)).toEqual(payload);
  });

  it("rejects keys that aren't component IDs", () => {
    expect(
      FormSubmissionPayloadSchema.safeParse({
        answers: { "Student Name": "Ada Lovelace" },
      }).success,
    ).toBe(false);
  });

  it("rejects values that no type accepts", () => {
    expect(
      FormSubmissionPayloadSchema.safeParse({
        answers: { [studentName.id]: { value: "Ada" } },
      }).success,
    ).toBe(false);
  });
});

describe("isImageAnswer", () => {
  it.each<[unknown, boolean]>([
    [{ uploadId: UPLOAD_ID }, true],
    [["a"], false],
    ["text", false],
    [true, false],
    [undefined, false],
  ])("%j is %s", (value, expected) => {
    expect(isImageAnswer(value as never)).toBe(expected);
  });
});
