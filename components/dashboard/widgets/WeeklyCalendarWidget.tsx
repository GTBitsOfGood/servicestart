import type { WidgetProps } from "@/lib/dashboard/widgets";
import {
  addCalendarDays,
  startOfDashboardWeek,
} from "@/lib/dashboard/calendar";
import { EventService } from "@/lib/services/EventService";
import WeeklyCalendarClient from "@/components/dashboard/widgets/WeeklyCalendarClient";

export default async function WeeklyCalendarWidget({
  organizationId,
}: WidgetProps) {
  const weekStart = startOfDashboardWeek(new Date());
  const weekEnd = addCalendarDays(weekStart, 7);
  const events = await EventService.listPublishedInRange(
    organizationId,
    weekStart,
    weekEnd,
  );

  return (
    <WeeklyCalendarClient
      initialWeekStart={weekStart.toISOString()}
      initialEvents={events.map((event) => ({
        id: event.id,
        name: event.name,
        startTimestamp: event.startTimestamp!.toISOString(),
      }))}
    />
  );
}
