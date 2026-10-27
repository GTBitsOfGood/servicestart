import { z } from "zod";
import {
  FormIdSchema,
  FormQuestionInputSchema,
  FormSettingsSchema,
} from "@/lib/forms/schema";

export const CreateFormSchema = z.strictObject({
  title: z.string().trim().min(1, "Title is required"),
  formId: FormIdSchema,
});

export const UpdateFormSchema = CreateFormSchema.partial().extend({
  description: z.string().nullable().optional(),
  settings: FormSettingsSchema.optional(),
});

export class FormError extends Error {
  constructor(
    public readonly reason: "not-found" | "conflict" | "invalid",
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "FormError";
  }
}

// Quote every cell, including headers, and neutralize spreadsheet formulas.
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^(?:[=+\-@\t\r\n]|\s+[=+\-@])/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function suggestFormId(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export const FORM_QUESTIONS_MAX = 200;

export const SaveQuestionsSchema = z.strictObject({
  questions: z
    .array(FormQuestionInputSchema)
    .max(FORM_QUESTIONS_MAX, `Use ${FORM_QUESTIONS_MAX} questions or fewer`)
    .superRefine((questions, ctx) => {
      const ids = new Set<string>();
      questions.forEach(({ id }, index) => {
        if (!id) return;
        if (ids.has(id))
          ctx.addIssue({
            code: "custom",
            message: "Question IDs must be unique",
            path: [index, "id"],
          });
        ids.add(id);
      });
    }),
});
