import {
  OrganizationConfigKey,
  type ToggleableOrganizationFeature,
} from "@/lib/schema";
import type { DashboardAudience } from "./audience";
import type { WidgetId } from "./schema";

/**
 * What every dashboard widget receives. Widgets are server components, so
 * they load their own data through services with these.
 */
export type WidgetProps = {
  organizationId: string;
  userId: string;
  audience: DashboardAudience;
  /**
   * The widget's settings from the layout, already checked against its
   * schema in WIDGET_CONFIG_SCHEMAS. Undefined when it has none.
   */
  config?: unknown;
};

interface WidgetMeta {
  label: string;
  /** A feature the org must have on for the widget to be offered. */
  requireConfig?: ToggleableOrganizationFeature;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetMeta> = {
  events: { label: "Events" },
  notifications: { label: "Notifications" },
  member_requests: { label: "New Member Requests" },
  newsletter: { label: "Newsletter" },
  application_status: {
    label: "Application Status",
    requireConfig: OrganizationConfigKey.FormsEnabled,
  },
  forms_todo: {
    label: "To-Do List",
    requireConfig: OrganizationConfigKey.FormsEnabled,
  },
  forms_completed: {
    label: "Completed Forms",
    requireConfig: OrganizationConfigKey.FormsEnabled,
  },
  forms_progress: {
    label: "Forms Progress",
    requireConfig: OrganizationConfigKey.FormsEnabled,
  },
  weekly_calendar: { label: "Weekly Calendar" },
};

/** The features widgets depend on, to look up before getWidgetOptions. */
export const WIDGET_FEATURE_KEYS = [
  ...new Set(
    Object.values(WIDGET_REGISTRY).flatMap(({ requireConfig }) =>
      requireConfig ? [requireConfig] : [],
    ),
  ),
];

/** Widgets an org can add, leaving out those whose feature is off. */
export function getWidgetOptions(
  enabledFeatures: Partial<Record<OrganizationConfigKey, unknown>> = {},
): { id: WidgetId; label: string }[] {
  return (Object.entries(WIDGET_REGISTRY) as [WidgetId, WidgetMeta][])
    .filter(
      ([, meta]) => !meta.requireConfig || enabledFeatures[meta.requireConfig],
    )
    .map(([id, meta]) => ({
      id,
      label: meta.label,
    }));
}
