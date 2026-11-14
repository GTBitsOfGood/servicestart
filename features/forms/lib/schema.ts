import { z } from "zod";
import { FormComponentType, FormStatus } from "@/features/forms/schema";
import { MemberTypeKeySchema, type MemberTypeKey } from "@/features/membership";

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
  .strictObject({
    requireLogin: z.boolean(),
    allowMultipleSubmissions: z.boolean(),
    opensAt: z.iso.datetime({ offset: true }).nullable(),
    closesAt: z.iso.datetime({ offset: true }).nullable(),
    confirmationMessage: z.string().trim().min(1),
    // Added in Sprint 4, so forms saved before then don't have them. Read them
    // through getAssignedMemberTypes, getDueAt, and getAcceptedMemberType.
    /** Member types this form is required for. Empty means nobody's. */
    assignedMemberTypes: z
      .array(MemberTypeKeySchema)
      .refine((types) => new Set(types).size === types.length, {
        message: "Choose each member type once",
      })
      .optional(),
    /** When it's due, shown on dashboards. `closesAt` is when it stops. */
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    /** The member type a submitter moves to once their response is accepted. */
    acceptedMemberType: MemberTypeKeySchema.nullable().optional(),
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

export function getAssignedMemberTypes(
  settings: FormSettings,
): MemberTypeKey[] {
  return settings.assignedMemberTypes ?? [];
}

export function getDueAt(settings: FormSettings): string | null {
  return settings.dueAt ?? null;
}

export function getAcceptedMemberType(
  settings: FormSettings,
): MemberTypeKey | null {
  return settings.acceptedMemberType ?? null;
}

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

export const CHOICE_OPTIONS_MAX = 50;

// The choices for single choice, checkboxes, and dropdown questions. Answers
// store the option text, which can't change once the form is published.
const ChoiceOptionsSchema = z
  .array(z.string().trim().min(1, "Options can't be blank"))
  .min(1, "Add at least one option")
  .max(CHOICE_OPTIONS_MAX, `Use ${CHOICE_OPTIONS_MAX} options or fewer`)
  .refine((options) => new Set(options).size === options.length, {
    message: "Each option must be different",
  });

export const ChoiceConfigSchema = z.strictObject({
  options: ChoiceOptionsSchema,
});

export const CheckboxesConfigSchema = z
  .strictObject({
    options: ChoiceOptionsSchema,
    minSelected: z.number().int().nonnegative().optional(),
    maxSelected: z.number().int().positive().optional(),
  })
  .refine(
    ({ minSelected, maxSelected }) =>
      minSelected === undefined ||
      maxSelected === undefined ||
      minSelected <= maxSelected,
    {
      message: "The minimum selected can't be more than the maximum",
      path: ["minSelected"],
    },
  )
  .refine(
    ({ options, minSelected }) =>
      minSelected === undefined || minSelected <= options.length,
    {
      message: "The minimum selected can't be more than the number of options",
      path: ["minSelected"],
    },
  );

// A calendar date with no time or time zone, e.g. "2027-06-02".
export const DateStringSchema = z.iso.date();

export const DateConfigSchema = z
  .strictObject({
    min: DateStringSchema.optional(),
    max: DateStringSchema.optional(),
  })
  .refine(({ min, max }) => !min || !max || min <= max, {
    message: "The earliest date can't be after the latest",
    path: ["min"],
  });

// Email, phone, image, section header, and yes/no have no settings.
export const EmptyConfigSchema = z.strictObject({});

// Groups deliberately use only scalar/list questions: no nesting or uploads.
export const SUB_QUESTION_CONFIG_SCHEMAS = {
  [FormComponentType.ShortText]: ShortTextConfigSchema,
  [FormComponentType.LongText]: LongTextConfigSchema,
  [FormComponentType.Email]: EmptyConfigSchema,
  [FormComponentType.Phone]: EmptyConfigSchema,
  [FormComponentType.Number]: NumberConfigSchema,
  [FormComponentType.SingleChoice]: ChoiceConfigSchema,
  [FormComponentType.Checkboxes]: CheckboxesConfigSchema,
  [FormComponentType.Dropdown]: ChoiceConfigSchema,
  [FormComponentType.Date]: DateConfigSchema,
  [FormComponentType.YesNo]: EmptyConfigSchema,
} as const;
export type SubQuestionType = keyof typeof SUB_QUESTION_CONFIG_SCHEMAS;
export const SUB_QUESTION_TYPES = Object.keys(
  SUB_QUESTION_CONFIG_SCHEMAS,
) as SubQuestionType[];

function subQuestion<T extends SubQuestionType>(type: T) {
  return z.strictObject({
    id: z.uuid(),
    type: z.literal(type),
    label: z.string().trim().min(1, "Add a label"),
    required: z.boolean(),
    config: SUB_QUESTION_CONFIG_SCHEMAS[type],
  });
}
const subQuestionSchemas = [
  subQuestion(FormComponentType.ShortText),
  subQuestion(FormComponentType.LongText),
  subQuestion(FormComponentType.Email),
  subQuestion(FormComponentType.Phone),
  subQuestion(FormComponentType.Number),
  subQuestion(FormComponentType.SingleChoice),
  subQuestion(FormComponentType.Checkboxes),
  subQuestion(FormComponentType.Dropdown),
  subQuestion(FormComponentType.Date),
  subQuestion(FormComponentType.YesNo),
] as const;
export const SubQuestionSchema = z.discriminatedUnion(
  "type",
  subQuestionSchemas,
);
export type SubQuestion = z.infer<typeof SubQuestionSchema>;
// IDs on new sub-questions are assigned by the server, just like questions.
export const SubQuestionInputSchema = z.discriminatedUnion("type", [
  subQuestionSchemas[0].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[1].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[2].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[3].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[4].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[5].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[6].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[7].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[8].extend({ id: z.uuid().optional() }),
  subQuestionSchemas[9].extend({ id: z.uuid().optional() }),
]);
export type SubQuestionInput = z.infer<typeof SubQuestionInputSchema>;

export const GROUP_QUESTIONS_MAX = 10;
export const GROUP_ENTRIES_MAX = 20;
function groupConfig<S extends z.ZodType<{ id?: string }>>(question: S) {
  return z
    .strictObject({
      questions: z
        .array(question)
        .min(1, "Add at least one sub-question")
        .max(GROUP_QUESTIONS_MAX)
        .refine((questions) => {
          const ids = questions.flatMap(({ id }) => (id ? [id] : []));
          return new Set(ids).size === ids.length;
        }, "Sub-question IDs must be unique"),
      repeatable: z.boolean(),
      minEntries: z.number().int().min(0).max(GROUP_ENTRIES_MAX).optional(),
      maxEntries: z.number().int().min(1).max(GROUP_ENTRIES_MAX).optional(),
      addLabel: z.string().trim().min(1).max(100).optional(),
    })
    .refine(
      ({ minEntries, maxEntries }) =>
        (minEntries ?? 0) <= (maxEntries ?? GROUP_ENTRIES_MAX),
      {
        message: "The minimum entries can't be more than the maximum",
        path: ["minEntries"],
      },
    )
    .refine(
      ({ repeatable, minEntries, maxEntries }) =>
        repeatable || ((minEntries ?? 1) === 1 && (maxEntries ?? 1) === 1),
      {
        message: "A non-repeating group has exactly one entry",
        path: ["minEntries"],
      },
    );
}
export const QuestionGroupConfigSchema = groupConfig(SubQuestionSchema);
export const QuestionGroupInputConfigSchema = groupConfig(
  SubQuestionInputSchema,
);

export const FORM_COMPONENT_CONFIG_SCHEMAS = {
  [FormComponentType.ShortText]: ShortTextConfigSchema,
  [FormComponentType.LongText]: LongTextConfigSchema,
  [FormComponentType.Email]: EmptyConfigSchema,
  [FormComponentType.Phone]: EmptyConfigSchema,
  [FormComponentType.Number]: NumberConfigSchema,
  [FormComponentType.Image]: EmptyConfigSchema,
  [FormComponentType.SectionHeader]: EmptyConfigSchema,
  [FormComponentType.SingleChoice]: ChoiceConfigSchema,
  [FormComponentType.Checkboxes]: CheckboxesConfigSchema,
  [FormComponentType.Dropdown]: ChoiceConfigSchema,
  [FormComponentType.Date]: DateConfigSchema,
  [FormComponentType.YesNo]: EmptyConfigSchema,
  [FormComponentType.QuestionGroup]: QuestionGroupConfigSchema,
} as const satisfies Record<FormComponentType, z.ZodType>;

export type FormComponentConfigFor<T extends FormComponentType> = z.infer<
  (typeof FORM_COMPONENT_CONFIG_SCHEMAS)[T]
>;

// Any type's config, e.g. the value stored in `form_components.config`.
export type FormComponentConfigValue =
  FormComponentConfigFor<FormComponentType>;

// Answer values

export const ImageAnswerSchema = z.strictObject({ uploadId: z.uuid() });

export const GroupEntryValueSchema = z.record(
  z.uuid(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
);
export const QuestionGroupAnswerSchema = z
  .array(GroupEntryValueSchema)
  .max(GROUP_ENTRIES_MAX);
export type GroupEntryValue = z.infer<typeof GroupEntryValueSchema>;

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
  // The chosen option's text.
  [FormComponentType.SingleChoice]: z.string(),
  // The chosen options' text.
  [FormComponentType.Checkboxes]: z.array(z.string()),
  [FormComponentType.Dropdown]: z.string(),
  [FormComponentType.Date]: z.string(),
  [FormComponentType.YesNo]: z.boolean(),
  [FormComponentType.QuestionGroup]: QuestionGroupAnswerSchema,
} as const satisfies Record<FormComponentType, z.ZodType>;

export type FormAnswerValueFor<T extends FormComponentType> = z.infer<
  (typeof FORM_ANSWER_VALUE_SCHEMAS)[T]
>;

// Any type's answer, e.g. the value stored in `form_answers.value`.
export const FormAnswerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  ImageAnswerSchema,
  QuestionGroupAnswerSchema,
]);
export type FormAnswerValue = z.infer<typeof FormAnswerValueSchema>;

export function isImageAnswer(
  value: unknown,
): value is FormAnswerValueFor<FormComponentType.Image> {
  return (
    typeof value === "object" &&
    value !== null &&
    "uploadId" in value &&
    typeof value.uploadId === "string"
  );
}

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
  typedConfig(FormComponentType.SingleChoice),
  typedConfig(FormComponentType.Checkboxes),
  typedConfig(FormComponentType.Dropdown),
  typedConfig(FormComponentType.Date),
  typedConfig(FormComponentType.YesNo),
  typedConfig(FormComponentType.QuestionGroup),
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
  component(FormComponentType.SingleChoice),
  component(FormComponentType.Checkboxes),
  component(FormComponentType.Dropdown),
  component(FormComponentType.Date),
  component(FormComponentType.YesNo),
  component(FormComponentType.QuestionGroup),
]);
export type FormComponent = z.infer<typeof FormComponentSchema>;
export type FormComponentOfType<T extends FormComponentType> = Extract<
  FormComponent,
  { type: T }
>;

// A question as the builder saves it: no position (the list order sets it),
// and no ID for a new question.
const questionInputFields = {
  id: z.uuid().optional(),
  label: z.string().trim().min(1, "Add a label"),
  helpText: z
    .string()
    .trim()
    .nullable()
    .transform((text) => text || null),
  required: z.boolean(),
};

function questionInput<T extends FormComponentType>(type: T) {
  return typedConfig(type).extend(questionInputFields).strict();
}

export const FormQuestionInputSchema = z.discriminatedUnion("type", [
  questionInput(FormComponentType.ShortText),
  questionInput(FormComponentType.LongText),
  questionInput(FormComponentType.Email),
  questionInput(FormComponentType.Phone),
  questionInput(FormComponentType.Number),
  questionInput(FormComponentType.Image),
  questionInput(FormComponentType.SectionHeader),
  questionInput(FormComponentType.SingleChoice),
  questionInput(FormComponentType.Checkboxes),
  questionInput(FormComponentType.Dropdown),
  questionInput(FormComponentType.Date),
  questionInput(FormComponentType.YesNo),
  z.strictObject({
    ...questionInputFields,
    type: z.literal(FormComponentType.QuestionGroup),
    config: QuestionGroupInputConfigSchema,
  }),
]);
export type FormQuestionInput = z.input<typeof FormQuestionInputSchema>;

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

/**
 * Validates answers that are safe to store in a draft. Every question is
 * optional and only its answer's stored shape is checked; submission-only
 * rules such as required answers, formats, ranges, and choices are deferred
 * until the member submits the form.
 */
export function buildDraftSchema(
  definition: Pick<FormDefinition, "components">,
) {
  const shape: Record<string, z.ZodType> = {};
  for (const component of definition.components) {
    shape[component.id] = FORM_ANSWER_VALUE_SCHEMAS[component.type].optional();
  }

  return z.strictObject(shape, {
    error: (issue) =>
      issue.code === "unrecognized_keys" ? "Unknown question" : undefined,
  }) as z.ZodType<Record<string, FormAnswerValue>>;
}

// What the fill-out page submits: answers keyed by component ID. Unanswered
// optional questions are left out.
export const FormSubmissionPayloadSchema = z.object({
  answers: z.record(z.uuid(), FormAnswerValueSchema),
});
export type FormSubmissionPayload = z.infer<typeof FormSubmissionPayloadSchema>;
