import { z } from "zod";
import { FormIdSchema } from "./schema";

// The application status widget's settings. The dashboard checks a layout's
// widget settings with this schema (WIDGET_CONFIG_SCHEMAS).

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
