import { z } from "zod";
import { FormIdSchema, FormSettingsSchema } from "@/lib/forms/schema";

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
