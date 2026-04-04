import { Suspense } from "react";
import type { DashboardLayout, WidgetId } from "@/lib/dashboard/schema";
import EventsWidget from "./widgets/EventsWidget";
import NotificationsDashboardWidget from "./widgets/NotificationsWidget";
import MemberRequestsWidget from "./widgets/MemberRequestsWidget";
import NewsletterWidget from "./widgets/NewsletterWidget";
import type { ComponentType } from "react";

const WIDGET_COMPONENTS: Record<WidgetId, ComponentType> = {
  events: EventsWidget,
  notifications: NotificationsDashboardWidget,
  member_requests: MemberRequestsWidget,
  newsletter: NewsletterWidget,
};

function WidgetFallback() {
  return (
    <div className="flex h-full animate-pulse items-center justify-center rounded-xl bg-white">
      <div className="h-4 w-24 rounded bg-grey-fill-weak" />
    </div>
  );
}

interface DashboardGridProps {
  layout: DashboardLayout;
}

export default function DashboardGrid({ layout }: DashboardGridProps) {
  const { widgets } = layout;

  if (widgets.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border-2 border-grey-stroke-weak bg-grey-fill-weaker text-grey-text-weak"
        style={{ height: "min(696px, calc(100dvh - 200px))" }}
      >
        No widgets configured
      </div>
    );
  }

  const columns = distributeWidgetsToColumns(widgets);

  return (
    <div
      className="grid grid-cols-2 gap-8"
      style={{ height: "min(696px, calc(100dvh - 200px))" }}
    >
      {columns.map((column, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-8">
          {column.map((widget) => {
            const Component = WIDGET_COMPONENTS[widget.id];
            const isTall = widget.size === "tall";
            return (
              <div
                key={widget.id}
                className={isTall ? "flex-1" : "h-1/2"}
                style={isTall ? { minHeight: 0 } : undefined}
              >
                <Suspense fallback={<WidgetFallback />}>
                  <Component />
                </Suspense>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function distributeWidgetsToColumns(
  widgets: DashboardLayout["widgets"],
): DashboardLayout["widgets"][] {
  if (widgets.length === 0) return [];

  const firstSize = widgets[0].size;
  let splitIndex = widgets.findIndex((w) => w.size !== firstSize);

  if (splitIndex === -1) {
    splitIndex = Math.ceil(widgets.length / 2);
  }

  const col1 = widgets.slice(0, splitIndex);
  const col2 = widgets.slice(splitIndex);

  return [col1, ...(col2.length > 0 ? [col2] : [])];
}
