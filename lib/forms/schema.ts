import { z } from "zod";
import { FormComponentType, FormStatus } from "@/lib/schema";

/*
 * Shared contract for forms. The builder, the renderer, the submission route,
 * and form management all validate against these schemas, so a change here is
 * a change for every forms ticket.
 */

export const FORM_ID_MAX_LENGTH = 64;

// The human-assigned key in a form's URL, e.g. "camp-application-2027".
export const FormIdSchema = z
  .string()
  .min(1)
  .max(FORM_ID_MAX_LENGTH)
  .regex(/^[a-z0-9-]+$/, {
    message: "Use only lowercase letters, numbers, and hyphens",
  });

export const FormSettingsSchema = z
  .object({
    requireLogin: z.boolean(),
    allowMultipleSubmissions: z.boolean(),
    opensAt: z.iso.datetime({ offset: true }).nullable(),
    closesAt: z.iso.datetime({ offset: true }).nullable(),
    confirmationMessage: z.string().trim().min(1),
  })
  .refine(
    ({ opensAt, closesAt }) =>
      !opensAt || !closesAt || Date.parse(opensAt) < Date.parse(closesAt),
    {
      message: "The close time must be after the open time",
      path: ["closesAt"],
    },
  );
export type FormSettings = z.infer<typeof FormSettingsSchema>;

// Per-type component config

export const ShortTextConfigSchema = z.strictObject({
  maxLength: z.number().int().positive().optional(),
});

export const LongTextConfigSchema = z
  .strictObject({
    minWords: z.number().int().nonnegative().optional(),
    maxWords: z.number().int().positive().optional(),
  })
  .refine(
    ({ minWords, maxWords }) =>
      minWords === undefined || maxWords === undefined || minWords <= maxWords,
    {
      message: "The minimum word count can't be more than the maximum",
      path: ["minWords"],
    },
  );

export const NumberConfigSchema = z
  .strictObject({
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  })
  .refine(
    ({ min, max }) => min === undefined || max === undefined || min <= max,
    { message: "The minimum can't be more than the maximum", path: ["min"] },
  );

// Email, phone, image, and section header have no settings.
export const EmptyConfigSchema = z.strictObject({});

export const FORM_COMPONENT_CONFIG_SCHEMAS = {
  [FormComponentType.ShortText]: ShortTextConfigSchema,
  [FormComponentType.LongText]: LongTextConfigSchema,
  [FormComponentType.Email]: EmptyConfigSchema,
  [FormComponentType.Phone]: EmptyConfigSchema,
  [FormComponentType.Number]: NumberConfigSchema,
  [FormComponentType.Image]: EmptyConfigSchema,
  [FormComponentType.SectionHeader]: EmptyConfigSchema,
} as const satisfies Record<FormComponentType, z.ZodType>;

export type FormComponentConfigFor<T extends FormComponentType> = z.infer<
  (typeof FORM_COMPONENT_CONFIG_SCHEMAS)[T]
>;

// Any type's config, e.g. the value stored in `form_components.config`.
export type FormComponentConfigValue =
  FormComponentConfigFor<FormComponentType>;

// Answer values

export const ImageAnswerSchema = z.strictObject({ uploadId: z.uuid() });

// Shapes only. Required answers, lengths, word counts, ranges, and email and
// phone formats are checked per form by buildSubmissionSchema (#299).
export const FORM_ANSWER_VALUE_SCHEMAS = {
  [FormComponentType.ShortText]: z.string(),
  [FormComponentType.LongText]: z.string(),
  [FormComponentType.Email]: z.string(),
  [FormComponentType.Phone]: z.string(),
  [FormComponentType.Number]: z.number(),
  [FormComponentType.Image]: ImageAnswerSchema,
  // Section headers take no answer.
  [FormComponentType.SectionHeader]: z.never(),
} as const satisfies Record<FormComponentType, z.ZodType>;

export type FormAnswerValueFor<T extends FormComponentType> = z.infer<
  (typeof FORM_ANSWER_VALUE_SCHEMAS)[T]
>;

// Any type's answer, e.g. the value stored in `form_answers.value`.
export const FormAnswerValueSchema = z.union([
  z.string(),
  z.number(),
  ImageAnswerSchema,
]);
export type FormAnswerValue = z.infer<typeof FormAnswerValueSchema>;

// Components

const componentFields = {
  id: z.uuid(),
  // A section header's title.
  label: z.string().trim().min(1),
  // A section header's description.
  helpText: z.string().nullable(),
  required: z.boolean(),
  position: z.number().int().nonnegative(),
};

function typedConfig<T extends FormComponentType>(type: T) {
  return z.object({
    type: z.literal(type),
    config: FORM_COMPONENT_CONFIG_SCHEMAS[type],
  });
}

function component<T extends FormComponentType>(type: T) {
  return typedConfig(type).extend(componentFields);
}

// `{ type, config }`, discriminated on `type`.
export const FormComponentConfigSchema = z.discriminatedUnion("type", [
  typedConfig(FormComponentType.ShortText),
  typedConfig(FormComponentType.LongText),
  typedConfig(FormComponentType.Email),
  typedConfig(FormComponentType.Phone),
  typedConfig(FormComponentType.Number),
  typedConfig(FormComponentType.Image),
  typedConfig(FormComponentType.SectionHeader),
]);
export type FormComponentConfig = z.infer<typeof FormComponentConfigSchema>;

export const FormComponentSchema = z.discriminatedUnion("type", [
  component(FormComponentType.ShortText),
  component(FormComponentType.LongText),
  component(FormComponentType.Email),
  component(FormComponentType.Phone),
  component(FormComponentType.Number),
  component(FormComponentType.Image),
  component(FormComponentType.SectionHeader),
]);
export type FormComponent = z.infer<typeof FormComponentSchema>;
export type FormComponentOfType<T extends FormComponentType> = Extract<
  FormComponent,
  { type: T }
>;

// A form plus its non-archived components, in position order.
export const FormDefinitionSchema = z
  .object({
    id: z.uuid(),
    formId: FormIdSchema,
    title: z.string().trim().min(1),
    description: z.string().nullable(),
    status: z.enum(FormStatus),
    settings: FormSettingsSchema,
    components: z.array(FormComponentSchema),
  })
  .superRefine(({ components }, ctx) => {
    const ids = new Set<string>();
    components.forEach((component, index) => {
      if (ids.has(component.id)) {
        ctx.addIssue({
          code: "custom",
          message: "Component IDs must be unique",
          path: ["components", index, "id"],
        });
      }
      ids.add(component.id);
      if (index > 0 && component.position <= components[index - 1].position) {
        ctx.addIssue({
          code: "custom",
          message: "Components must be in position order",
          path: ["components", index, "position"],
        });
      }
    });
  });
export type FormDefinition = z.infer<typeof FormDefinitionSchema>;

// What the fill-out page submits: answers keyed by component ID. Unanswered
// optional questions are left out.
export const FormSubmissionPayloadSchema = z.object({
  answers: z.record(z.uuid(), FormAnswerValueSchema),
});
export type FormSubmissionPayload = z.infer<typeof FormSubmissionPayloadSchema>;
