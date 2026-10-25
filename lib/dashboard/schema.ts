import { z } from "zod";
import { FormIdSchema } from "@/lib/forms/schema";

export const WIDGET_IDS = [
  "events",
  "notifications",
  "member_requests",
  "newsletter",
  // Sprint 4 widgets, each owned by one ticket.
  "application_status", // #318
  "forms_todo", // #319
  "forms_completed", // #319
  "forms_progress", // #319
  "weekly_calendar", // #320
] as const;

export const WIDGET_SIZES = ["tall", "small"] as const;

export const LAYOUT_DIRECTIONS = ["vertical", "horizontal"] as const;

export const WidgetIdSchema = z.enum(WIDGET_IDS);

export const WidgetSizeSchema = z.enum(WIDGET_SIZES);

export type WidgetId = z.infer<typeof WidgetIdSchema>;

// Per-widget settings

const ApplicationStatusStepSchema = z.strictObject({
  label: z.string().trim().min(1, "Give the step a name").max(40),
  description: z.string().trim().max(200),
});

/**
 * The application the status card follows, and its three timeline steps:
 * submitted (pending), under review, and decision (accepted or rejected).
 */
export const ApplicationStatusWidgetConfigSchema = z.strictObject({
  formId: FormIdSchema,
  steps: z.tuple([
    ApplicationStatusStepSchema,
    ApplicationStatusStepSchema,
    ApplicationStatusStepSchema,
  ]),
});
export type ApplicationStatusWidgetConfig = z.infer<
  typeof ApplicationStatusWidgetConfigSchema
>;

export const DEFAULT_APPLICATION_STATUS_STEPS: ApplicationStatusWidgetConfig["steps"] =
  [
    { label: "Submitted", description: "Your application has been received." },
    {
      label: "Under Review",
      description: "Our team is reviewing your application.",
    },
    { label: "Decision", description: "Your status will be shared with you." },
  ];

/**
 * Settings for widgets that take them. Widgets without an entry take none.
 * A widget's settings are optional: without them it shows an empty state.
 */
export const WIDGET_CONFIG_SCHEMAS: Partial<Record<WidgetId, z.ZodType>> = {
  application_status: ApplicationStatusWidgetConfigSchema,
};

export const DashboardWidgetSchema = z
  .object({
    id: WidgetIdSchema,
    size: WidgetSizeSchema,
    config: z.unknown().optional(),
  })
  .superRefine(({ id, config }, ctx) => {
    if (config === undefined) return;
    const schema = WIDGET_CONFIG_SCHEMAS[id];
    if (!schema) {
      ctx.addIssue({
        code: "custom",
        message: "This widget has no settings",
        path: ["config"],
      });
      return;
    }
    const result = schema.safeParse(config);
    for (const issue of result.error?.issues ?? []) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: ["config", ...issue.path],
      });
    }
  });

export const DashboardLayoutSchema = z
  .object({
    layout: z.enum(LAYOUT_DIRECTIONS),
    widgets: z.array(DashboardWidgetSchema).max(4),
  })
  .refine(
    (data) => {
      const ids = data.widgets.map((w) => w.id);
      return new Set(ids).size === ids.length;
    },
    { message: "Duplicate widget IDs are not allowed" },
  );

export type WidgetSize = z.infer<typeof WidgetSizeSchema>;
export type DashboardWidget = z.infer<typeof DashboardWidgetSchema>;
export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>;
