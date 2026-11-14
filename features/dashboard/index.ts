// The dashboard context's public API: other contexts import from
// "@/features/dashboard", never from a file inside it.

export { pruneAudienceRecord } from "./lib/audienceRecord";
export { ApplicationStatusWidgetConfigSchema } from "./lib/schema";
export type { WidgetProps } from "./widgets";
