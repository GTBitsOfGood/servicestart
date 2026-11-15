// The forms context's public API: other contexts import from
// "@/features/forms", never from a file inside it.
// Its React components and widgets are in ./ui.ts.

export { FormIdSchema } from "./lib/schema";
export {
  ApplicationStatusWidgetConfigSchema,
  DEFAULT_APPLICATION_STATUS_STEPS,
  type ApplicationStatusWidgetConfig,
} from "./lib/applicationStatusConfig";
