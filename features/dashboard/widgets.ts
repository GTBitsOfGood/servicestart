import type { OrganizationConfigKey } from "@/core/config/schema";
import { FEATURES } from "@/features/registry";
import type { DashboardAudience } from "@/features/membership";
import { WIDGET_IDS, type WidgetId } from "./lib/schema";

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

/**
 * Widgets an org can add, from the feature manifests, in WIDGET_IDS order.
 * A widget is left out while its feature's toggle is off.
 */
export function getWidgetOptions(
  enabledFeatures: Partial<Record<OrganizationConfigKey, unknown>> = {},
): { id: WidgetId; label: string }[] {
  const widgets = new Map(
    FEATURES.flatMap(({ toggle, widgets = [] }) =>
      widgets.map((widget) => [widget.id, { ...widget, toggle }] as const),
    ),
  );
  return WIDGET_IDS.flatMap((id) => {
    const widget = widgets.get(id);
    if (!widget || (widget.toggle && !enabledFeatures[widget.toggle])) {
      return [];
    }
    return [{ id, label: widget.label }];
  });
}
