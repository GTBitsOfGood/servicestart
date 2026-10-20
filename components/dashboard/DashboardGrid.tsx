import { Suspense } from "react";
import type { ComponentType } from "react";
import type { DashboardAudience } from "@/lib/dashboard/audience";
import type { DashboardLayout, WidgetId } from "@/lib/dashboard/schema";
import type { WidgetProps } from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";
import EventsWidget from "./widgets/EventsWidget";
import NotificationsDashboardWidget from "./widgets/NotificationsWidget";
import MemberRequestsWidget from "./widgets/MemberRequestsWidget";
import NewsletterWidget from "./widgets/NewsletterWidget";
import ApplicationStatusWidget from "./widgets/ApplicationStatusWidget";
import FormsTodoWidget from "./widgets/FormsTodoWidget";
import FormsCompletedWidget from "./widgets/FormsCompletedWidget";
import FormsProgressWidget from "./widgets/FormsProgressWidget";
import WeeklyCalendarWidget from "./widgets/WeeklyCalendarWidget";

const WIDGET_COMPONENTS: Record<WidgetId, ComponentType<WidgetProps>> = {
  events: EventsWidget,
  notifications: NotificationsDashboardWidget,
  member_requests: MemberRequestsWidget,
  newsletter: NewsletterWidget,
  application_status: ApplicationStatusWidget,
  forms_todo: FormsTodoWidget,
  forms_completed: FormsCompletedWidget,
  forms_progress: FormsProgressWidget,
  weekly_calendar: WeeklyCalendarWidget,
};

function WidgetFallback() {
  return (
    <div className="flex h-full animate-pulse items-center justify-center rounded-xl bg-solid-bg-base">
      <div className="h-4 w-24 rounded bg-grey-fill-weak" />
    </div>
  );
}

interface DashboardGridProps {
  layout: DashboardLayout;
  organizationId: string;
  userId: string;
  audience: DashboardAudience;
}

/**
 * Two columns that fill the screen from the `mobile` breakpoint up, and one
 * stacked column below it.
 */
export default function DashboardGrid({
  layout,
  organizationId,
  userId,
  audience,
}: DashboardGridProps) {
  const { widgets } = layout;

  if (widgets.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border-2 border-grey-stroke-weak bg-grey-fill-weaker text-grey-text-weak mobile:h-dashboard-grid">
        No widgets configured
      </div>
    );
  }

  const columns = distributeWidgetsToColumns(widgets);

  return (
    <div className="flex flex-col gap-6 mobile:grid mobile:h-dashboard-grid mobile:grid-cols-2 mobile:gap-8">
      {columns.map((column, colIdx) => (
        <div key={colIdx} className="flex min-h-0 flex-col gap-6 mobile:gap-8">
          {column.map((widget) => {
            const Component = WIDGET_COMPONENTS[widget.id];
            return (
              <div
                key={widget.id}
                data-widget-id={widget.id}
                // A grid, so the widget fills the slot's minimum height when
                // the widgets stack.
                className={cn(
                  "grid mobile:block mobile:min-h-0",
                  widget.size === "tall"
                    ? "min-h-96 mobile:flex-1"
                    : "min-h-64 mobile:h-1/2",
                )}
              >
                <Suspense fallback={<WidgetFallback />}>
                  <Component
                    organizationId={organizationId}
                    userId={userId}
                    audience={audience}
                    config={widget.config}
                  />
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
