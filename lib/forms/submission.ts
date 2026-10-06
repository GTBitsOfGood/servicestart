import { z } from "zod";
import { FormComponentType, FormStatus } from "@/lib/schema";
import type {
  FormAnswerValue,
  FormComponent,
  FormDefinition,
} from "@/lib/forms/schema";

/*
 * Per-form answer validation. Pure and safe to import on the client: the
 * fill-out page and the submit route both validate with buildSubmissionSchema.
 */

export const REQUIRED_MESSAGE = "This question is required";
const TEXT_MESSAGE = "Enter text";
const EMAIL_MESSAGE = "Enter a valid email address";
const PHONE_MESSAGE = "Enter a valid US phone number";
const NUMBER_MESSAGE = "Enter a number";
const WHOLE_NUMBER_MESSAGE = "Enter a whole number";
const IMAGE_MESSAGE = "Upload an image";

// A 10-digit US number with an optional +1, e.g. (404) 555-0123,
// 404-555-0123, 404.555.0123, +1 404 555 0123, or 4045550123.
const US_PHONE_PATTERN =
  /^(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})$/;

const NUMBER_INPUT_PATTERN = /^-?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** The number's 10 digits, or null if it isn't a US phone number. */
export function normalizePhone(value: string) {
  const match = US_PHONE_PATTERN.exec(value.trim());
  return match ? match.slice(1).join("") : null;
}

/** Undefined for a blank input and NaN for one that isn't a number. */
export function parseNumberInput(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return NUMBER_INPUT_PATTERN.test(trimmed) ? Number(trimmed) : NaN;
}

function rangeMessage(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) {
    return `Enter a number from ${min} to ${max}`;
  }
  return min !== undefined
    ? `Enter a number ${min} or higher`
    : `Enter a number ${max} or lower`;
}

// Missing answers get the required message; wrong types get `message`.
function typeError(message: string) {
  return (issue: { input?: unknown }) =>
    issue.input === undefined ? REQUIRED_MESSAGE : message;
}

function answerSchema(component: FormComponent): z.ZodType | null {
  switch (component.type) {
    case FormComponentType.ShortText: {
      const { maxLength } = component.config;
      const schema = z.string({ error: typeError(TEXT_MESSAGE) }).trim();
      return maxLength === undefined
        ? schema
        : schema.max(maxLength, `Use ${maxLength} characters or fewer`);
    }
    case FormComponentType.LongText: {
      const { minWords, maxWords } = component.config;
      return z
        .string({ error: typeError(TEXT_MESSAGE) })
        .trim()
        .refine(
          (value) => minWords === undefined || countWords(value) >= minWords,
          {
            message: `Write at least ${minWords} words`,
          },
        )
        .refine(
          (value) => maxWords === undefined || countWords(value) <= maxWords,
          {
            message: `Write ${maxWords} words or fewer`,
          },
        );
    }
    case FormComponentType.Email:
      return z
        .string({ error: typeError(EMAIL_MESSAGE) })
        .trim()
        .pipe(z.email(EMAIL_MESSAGE));
    case FormComponentType.Phone:
      return z
        .string({ error: typeError(PHONE_MESSAGE) })
        .transform((value, ctx) => {
          const digits = normalizePhone(value);
          if (!digits) {
            ctx.addIssue({ code: "custom", message: PHONE_MESSAGE });
            return z.NEVER;
          }
          return digits;
        });
    case FormComponentType.Number: {
      const { min, max, integer } = component.config;
      const schema = z.number({ error: typeError(NUMBER_MESSAGE) });
      return (integer ? schema.int(WHOLE_NUMBER_MESSAGE) : schema).refine(
        (value) =>
          (min === undefined || value >= min) &&
          (max === undefined || value <= max),
        { message: rangeMessage(min, max) },
      );
    }
    case FormComponentType.Image:
      return z.strictObject(
        { uploadId: z.uuid(IMAGE_MESSAGE) },
        { error: typeError(IMAGE_MESSAGE) },
      );
    case FormComponentType.SectionHeader:
      return null;
  }
}

function isBlank(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * Validates a submission's answers, keyed by component ID, against a form's
 * questions. Blank answers count as unanswered, answers to section headers are
 * dropped, and other unknown IDs are rejected. Phone numbers come out as
 * digits only.
 */
export function buildSubmissionSchema(
  definition: Pick<FormDefinition, "components">,
) {
  const shape: Record<string, z.ZodType> = {};
  const sectionHeaderIds = new Set<string>();
  for (const component of definition.components) {
    const schema = answerSchema(component);
    if (!schema) {
      sectionHeaderIds.add(component.id);
      continue;
    }
    shape[component.id] = component.required ? schema : schema.optional();
  }

  return z.preprocess(
    (answers) =>
      answers && typeof answers === "object" && !Array.isArray(answers)
        ? Object.fromEntries(
            Object.entries(answers).filter(
              ([id, value]) => !sectionHeaderIds.has(id) && !isBlank(value),
            ),
          )
        : answers,
    z.strictObject(shape, {
      error: (issue) =>
        issue.code === "unrecognized_keys" ? "Unknown question" : undefined,
    }),
  ) as z.ZodType<Record<string, FormAnswerValue>>;
}

/**
 * The first error for each question, keyed by component ID. Errors that
 * aren't about one question, like unknown IDs, are keyed by "".
 */
export function getAnswerErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const [id] = issue.path;
    errors[typeof id === "string" ? id : ""] ??= issue.message;
  }
  return errors;
}

export type FormAvailability = "open" | "not_yet_open" | "closed";

/** Whether a form takes responses now. Drafts and closed forms don't. */
export function getFormAvailability(
  form: Pick<FormDefinition, "status" | "settings">,
  now = new Date(),
): FormAvailability {
  if (form.status !== FormStatus.Published) return "closed";
  const { opensAt, closesAt } = form.settings;
  if (opensAt && now < new Date(opensAt)) return "not_yet_open";
  if (closesAt && now >= new Date(closesAt)) return "closed";
  return "open";
}
