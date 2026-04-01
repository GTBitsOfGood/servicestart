import authClient from "./authClient";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export function getBaseUrl() {
  return (
    (process.env.NEXT_PUBLIC_BASE_URL?.includes("main--")
      ? process.env.NEXT_PUBLIC_PROD_URL
      : process.env.NEXT_PUBLIC_BASE_URL) || "http://localhost:3000"
  );
}

export function isAdmin(
  organization:
    | ReturnType<typeof authClient.useActiveOrganization>["data"]
    | null
    | undefined,
  user:
    | NonNullable<ReturnType<typeof authClient.useSession>["data"]>["user"]
    | null
    | undefined,
): boolean {
  if (!organization || !user) {
    return false;
  }
  return (
    organization?.members.some(
      (member) =>
        member.userId === user.id &&
        (member.role === "admin" || member.role === "owner"),
    ) ?? false
  );
}

export function parseDurationMinutes(duration: string | null) {
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

  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const durationMinutes = parseDurationMinutes(duration);
  const endTime = durationMinutes
    ? new Date(
        start.getTime() + durationMinutes * 60 * 1000,
      ).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return { date, time, endTime };
}

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
