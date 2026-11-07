import WeeklyCalendarClient from "@/features/events/widgets/WeeklyCalendarClient";

export default function WeeklyCalendarWidget() {
  // The viewer's current week depends on their browser timezone. Calculating
  // it in this server component would shift Monday into Sunday for users west
  // of UTC, so the client owns the initial range as well as week navigation.
  return <WeeklyCalendarClient />;
}
