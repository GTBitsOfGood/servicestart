// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FormComponentType, FormStatus } from "@/lib/schema";
import { DEFAULT_FORM_SETTINGS } from "@/lib/forms/constants";
import type { FormComponent } from "@/lib/forms/schema";
import {
  REQUIRED_MESSAGE,
  buildSubmissionSchema,
  countWords,
  getAnswerErrors,
  getFormAvailability,
  normalizePhone,
  parseNumberInput,
} from "@/lib/forms/submission";
import {
  VISIONARIES_APPLICATION_FORM,
  buildSampleAnswers,
} from "@/tests/unit/fixtures/forms";

const UPLOAD_ID = "3b0f6a52-8c1d-4e7a-9f20-6d5c4b3a2910";

const IDS = {
  header: "00000000-0000-4000-8000-000000000001",
  shortText: "00000000-0000-4000-8000-000000000002",
  longText: "00000000-0000-4000-8000-000000000003",
  email: "00000000-0000-4000-8000-000000000004",
  phone: "00000000-0000-4000-8000-000000000005",
  number: "00000000-0000-4000-8000-000000000006",
  image: "00000000-0000-4000-8000-000000000007",
  optional: "00000000-0000-4000-8000-000000000008",
};

const base = { helpText: null, required: true };

const COMPONENTS: FormComponent[] = [
  {
    ...base,
    id: IDS.header,
    type: FormComponentType.SectionHeader,
    label: "About you",
    required: false,
    position: 0,
    config: {},
  },
  {
    ...base,
    id: IDS.shortText,
    type: FormComponentType.ShortText,
    label: "Name",
    position: 1,
    config: { maxLength: 10 },
  },
  {
    ...base,
    id: IDS.longText,
    type: FormComponentType.LongText,
    label: "Why",
    position: 2,
    config: { minWords: 3, maxWords: 5 },
  },
  {
    ...base,
    id: IDS.email,
    type: FormComponentType.Email,
    label: "Email",
    position: 3,
    config: {},
  },
  {
    ...base,
    id: IDS.phone,
    type: FormComponentType.Phone,
    label: "Phone",
    position: 4,
    config: {},
  },
  {
    ...base,
    id: IDS.number,
    type: FormComponentType.Number,
    label: "Grade",
    position: 5,
    config: { min: 1, max: 12, integer: true },
  },
  {
    ...base,
    id: IDS.image,
    type: FormComponentType.Image,
    label: "Headshot",
    position: 6,
    config: {},
  },
  {
    ...base,
    id: IDS.optional,
    type: FormComponentType.ShortText,
    label: "Nickname",
    required: false,
    position: 7,
    config: {},
  },
];

const VALID_ANSWERS = {
  [IDS.shortText]: "Ada",
  [IDS.longText]: "I love to code",
  [IDS.email]: "ada@example.com",
  [IDS.phone]: "(404) 555-0123",
  [IDS.number]: 9,
  [IDS.image]: { uploadId: UPLOAD_ID },
};

const schema = buildSubmissionSchema({ components: COMPONENTS });

function errorsFor(answers: Record<string, unknown>) {
  const result = schema.safeParse(answers);
  expect(result.success).toBe(false);
  return result.success ? {} : getAnswerErrors(result.error);
}

// The answer's error, or undefined when the answers are valid.
function errorFor(id: string, value: unknown) {
  const result = schema.safeParse({ ...VALID_ANSWERS, [id]: value });
  return result.success ? undefined : getAnswerErrors(result.error)[id];
}

describe("buildSubmissionSchema", () => {
  it("accepts valid answers to every type", () => {
    const result = schema.safeParse(VALID_ANSWERS);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      ...VALID_ANSWERS,
      [IDS.phone]: "4045550123",
    });
  });

  it("accepts the Visionaries application's sample answers", () => {
    const answers = buildSampleAnswers(VISIONARIES_APPLICATION_FORM, {
      uploadId: UPLOAD_ID,
    });
    expect(
      buildSubmissionSchema(VISIONARIES_APPLICATION_FORM).safeParse(answers)
        .success,
    ).toBe(true);
  });

  it.each(Object.entries(VALID_ANSWERS))(
    "requires a required answer (%s)",
    (id) => {
      const answers: Record<string, unknown> = { ...VALID_ANSWERS };
      delete answers[id];
      expect(errorsFor(answers)[id]).toBe(REQUIRED_MESSAGE);
    },
  );

  it("treats blank and null answers as missing", () => {
    expect(errorFor(IDS.shortText, "   ")).toBe(REQUIRED_MESSAGE);
    expect(errorFor(IDS.number, null)).toBe(REQUIRED_MESSAGE);
  });

  it("leaves blank optional answers out", () => {
    const result = schema.safeParse({ ...VALID_ANSWERS, [IDS.optional]: " " });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty(IDS.optional);
  });

  it("trims text answers", () => {
    const result = schema.safeParse({
      ...VALID_ANSWERS,
      [IDS.shortText]: "  Ada  ",
      [IDS.email]: " ada@example.com ",
    });
    expect(result.data?.[IDS.shortText]).toBe("Ada");
    expect(result.data?.[IDS.email]).toBe("ada@example.com");
  });

  it.each([
    [IDS.shortText, 5],
    [IDS.longText, ["a", "b", "c"]],
    [IDS.email, 5],
    [IDS.phone, 4045550123],
    [IDS.number, "9"],
    [IDS.image, "photo.png"],
    [IDS.image, { uploadId: "not-a-uuid" }],
    [IDS.image, { uploadId: UPLOAD_ID, url: "https://example.com" }],
  ])("rejects the wrong type for %s", (id, value) => {
    const error = errorFor(id, value);
    expect(error).toBeDefined();
    expect(error).not.toBe(REQUIRED_MESSAGE);
  });

  it("enforces short text's max length", () => {
    expect(errorFor(IDS.shortText, "a".repeat(10))).toBeUndefined();
    expect(errorFor(IDS.shortText, "a".repeat(11))).toBe(
      "Use 10 characters or fewer",
    );
  });

  it("enforces long text's word counts", () => {
    expect(errorFor(IDS.longText, "one two")).toBe("Write at least 3 words");
    expect(errorFor(IDS.longText, "one\ntwo   three")).toBeUndefined();
    expect(errorFor(IDS.longText, "a b c d e")).toBeUndefined();
    expect(errorFor(IDS.longText, "a b c d e f")).toBe(
      "Write 5 words or fewer",
    );
  });

  it("enforces number ranges and whole numbers", () => {
    expect(errorFor(IDS.number, 1)).toBeUndefined();
    expect(errorFor(IDS.number, 12)).toBeUndefined();
    expect(errorFor(IDS.number, 0)).toBe("Enter a number from 1 to 12");
    expect(errorFor(IDS.number, 13)).toBe("Enter a number from 1 to 12");
    expect(errorFor(IDS.number, 9.5)).toBe("Enter a whole number");
    expect(errorFor(IDS.number, NaN)).toBe("Enter a number");
  });

  it("describes one-sided number ranges", () => {
    const [, , , , , number] = COMPONENTS;
    const atLeast = buildSubmissionSchema({
      components: [{ ...number, config: { min: 2 } } as FormComponent],
    });
    const atMost = buildSubmissionSchema({
      components: [{ ...number, config: { max: 2 } } as FormComponent],
    });
    expect(atLeast.safeParse({ [IDS.number]: 2.5 }).success).toBe(true);
    expect(
      atLeast.safeParse({ [IDS.number]: 1 }).error?.issues[0].message,
    ).toBe("Enter a number 2 or higher");
    expect(atMost.safeParse({ [IDS.number]: 3 }).error?.issues[0].message).toBe(
      "Enter a number 2 or lower",
    );
  });

  it.each(["ada", "ada@", "ada@example", "ada @example.com"])(
    "rejects the bad email %j",
    (email) => {
      expect(errorFor(IDS.email, email)).toBe("Enter a valid email address");
    },
  );

  it.each([
    ["404-555-0123", "4045550123"],
    ["404.555.0123", "4045550123"],
    ["(404) 555-0123", "4045550123"],
    ["+1 404 555 0123", "4045550123"],
    ["1-404-555-0123", "4045550123"],
    ["4045550123", "4045550123"],
  ])("stores the phone number %j as digits", (phone, digits) => {
    const result = schema.safeParse({ ...VALID_ANSWERS, [IDS.phone]: phone });
    expect(result.data?.[IDS.phone]).toBe(digits);
  });

  it.each([
    "555-0123",
    "404-555-01234",
    "+44 20 7946 0958",
    "123-555-0123",
    "phone",
  ])("rejects the bad phone number %j", (phone) => {
    expect(errorFor(IDS.phone, phone)).toBe("Enter a valid US phone number");
  });

  it("rejects unknown question IDs", () => {
    const errors = errorsFor({
      ...VALID_ANSWERS,
      "00000000-0000-4000-8000-0000000000ff": "extra",
    });
    expect(errors[""]).toBe("Unknown question");
  });

  it("ignores answers to section headers", () => {
    const result = schema.safeParse({ ...VALID_ANSWERS, [IDS.header]: "hi" });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty(IDS.header);
  });

  it("rejects answers that aren't an object", () => {
    expect(schema.safeParse([]).success).toBe(false);
    expect(schema.safeParse("answers").success).toBe(false);
  });
});

describe("getAnswerErrors", () => {
  it("keeps the first error for each question", () => {
    const errors = errorsFor({ ...VALID_ANSWERS, [IDS.number]: 13.5 });
    expect(errors).toEqual({ [IDS.number]: "Enter a whole number" });
  });
});

describe("countWords", () => {
  it.each([
    ["", 0],
    ["   ", 0],
    ["one", 1],
    [" one  two\nthree\t", 3],
  ])("counts %j as %i words", (text, count) => {
    expect(countWords(text)).toBe(count);
  });
});

describe("normalizePhone", () => {
  it("returns null for a non-US number", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBeNull();
  });
});

describe("parseNumberInput", () => {
  it.each([
    ["", undefined],
    ["  ", undefined],
    ["9", 9],
    [" -2.5 ", -2.5],
    [".5", 0.5],
  ])("parses %j", (text, value) => {
    expect(parseNumberInput(text)).toBe(value);
  });

  it.each(["abc", "1e3", "0x10", "1,000"])("rejects %j", (text) => {
    expect(parseNumberInput(text)).toBeNaN();
  });
});

describe("getFormAvailability", () => {
  const now = new Date("2027-03-01T12:00:00Z");
  const form = (
    status: FormStatus,
    window: { opensAt?: string; closesAt?: string } = {},
  ) => ({
    status,
    settings: {
      ...DEFAULT_FORM_SETTINGS,
      opensAt: window.opensAt ?? null,
      closesAt: window.closesAt ?? null,
    },
  });

  it("is open for a published form with no window", () => {
    expect(getFormAvailability(form(FormStatus.Published), now)).toBe("open");
  });

  it("is closed for drafts and closed forms", () => {
    expect(getFormAvailability(form(FormStatus.Draft), now)).toBe("closed");
    expect(getFormAvailability(form(FormStatus.Closed), now)).toBe("closed");
  });

  it("follows the open/close window", () => {
    const window = {
      opensAt: "2027-02-01T00:00:00Z",
      closesAt: "2027-04-01T00:00:00Z",
    };
    const published = form(FormStatus.Published, window);
    expect(getFormAvailability(published, now)).toBe("open");
    expect(
      getFormAvailability(published, new Date("2027-01-31T23:59:59Z")),
    ).toBe("not_yet_open");
    expect(
      getFormAvailability(published, new Date("2027-04-01T00:00:00Z")),
    ).toBe("closed");
  });
});
