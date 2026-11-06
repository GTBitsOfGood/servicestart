// The dashboard context's public API: other contexts import from
// "@/features/dashboard", never from a file inside it.

export { ApplicationStatusWidgetConfigSchema } from "./lib/schema";
export type { WidgetProps } from "./widgets";
