// Date formatting shared by every feature. All output is en-US, in the
// runtime's time zone unless a function says otherwise.

/** "Jun 2, 2027". Pass `timeZone` to format in a zone other than the runtime's. */
export function formatShortDate(
  value: string | number | Date,
  { timeZone }: { timeZone?: string } = {},
): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(timeZone ? { timeZone } : {}),
  });
}

/** "06/02/2027". */
export function formatNumericDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

/** "9:05 AM". */
export function formatClockTime(value: string | number | Date): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * How long ago: "Just now", "5 mins ago", "3 hrs ago", "2 days ago", then the
 * date ("Jun 2, 2027") after a week.
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hrs ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return formatShortDate(date);
}
