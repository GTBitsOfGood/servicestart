import { formatClockTime } from "@/core/utils/dates";

// Event-specific date formatting.

// TODO(#337 follow-up): this and parseDurationMinutes in ./events.ts disagree
// on durations with seconds ("01:30:45" is 90 here, 90.75 there) and on
// "H:MM". Merge them once the event page's end time is checked against both.
function durationMinutesForDisplay(duration: string | null) {
  if (!duration) return null;

  const timeMatch = duration.match(/^\s*(\d+):(\d+)(?::\d+)?\s*$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1] ?? 0);
    const minutes = Number(timeMatch[2] ?? 0);
    return hours * 60 + minutes;
  }

  const hourMatch = duration.match(/(\d+)\s*hour/);
  const minuteMatch = duration.match(/(\d+)\s*minute/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = hours * 60 + minutes;

  return total > 0 ? total : null;
}

/** An event's start date, start time, and end time, for the event page. */
export function formatDateTime(
  startTimestamp: Date | null,
  duration: string | null,
) {
  if (!startTimestamp) {
    return { date: "TBD", time: "", endTime: "" };
  }

  const start = new Date(startTimestamp);
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });

  const time = formatClockTime(start);

  const durationMinutes = durationMinutesForDisplay(duration);
  const endTime = durationMinutes
    ? formatClockTime(start.getTime() + durationMinutes * 60 * 1000)
    : "";

  return { date, time, endTime };
}

/** "Wednesday, June 2 at 9:05 AM", or "—" without a deadline. */
export function formatRsvpDeadline(deadline: Date | null) {
  if (!deadline) return "—";
  return deadline.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
