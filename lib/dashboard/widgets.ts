import type { WidgetId } from "./schema";

interface WidgetMeta {
  label: string;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetMeta> = {
  events: { label: "Events" },
  notifications: { label: "Notifications" },
  member_requests: { label: "New Member Requests" },
  newsletter: { label: "Newsletter" },
};

export function getWidgetOptions(): { id: WidgetId; label: string }[] {
  return (Object.entries(WIDGET_REGISTRY) as [WidgetId, WidgetMeta][]).map(
    ([id, meta]) => ({
      id,
      label: meta.label,
    }),
  );
}
