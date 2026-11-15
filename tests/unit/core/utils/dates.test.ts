// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  formatClockTime,
  formatNumericDate,
  formatRelativeTime,
  formatShortDate,
} from "@/core/utils/dates";
import {
  formatDateTime,
  formatRsvpDeadline,
} from "@/features/events/lib/eventDates";
import { formatDateString } from "@/features/forms/lib/submission";

/*
 * Output of the shared date formatters, recorded before #337 merged their
 * copies. Each "inline" helper below is a copy that was merged away, kept here
 * so the test shows the shared formatter prints exactly what it did.
 */
const inlineShortDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const inlineIntlShortDate = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
const inlineClockTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

const previousTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/New_York";
});
afterAll(() => {
  process.env.TZ = previousTz;
  vi.useRealTimers();
});

const SAMPLES = [
  "2027-06-02T09:05:00.000Z",
  "2026-12-31T23:30:00.000Z",
  "2026-01-01T04:59:59.000Z",
];

describe("date formatters", () => {
  it.each(SAMPLES)("formats %s as before", (iso) => {
    expect({
      numeric: formatNumericDate(iso),
      dateTime: formatDateTime(new Date(iso), "01:30:00"),
      noDuration: formatDateTime(new Date(iso), null),
      rsvp: formatRsvpDeadline(new Date(iso)),
      inlineShortDate: inlineShortDate(iso),
      inlineIntlShortDate: inlineIntlShortDate(new Date(iso)),
      inlineClockTime: inlineClockTime(iso),
    }).toMatchSnapshot();
  });

  it.each(SAMPLES)("prints %s like the copies it replaced", (iso) => {
    expect(formatShortDate(iso)).toBe(inlineShortDate(iso));
    expect(formatShortDate(new Date(iso))).toBe(
      inlineIntlShortDate(new Date(iso)),
    );
    expect(formatClockTime(iso)).toBe(inlineClockTime(iso));
  });

  it("formats a missing start and deadline as before", () => {
    expect(formatDateTime(null, null)).toEqual({
      date: "TBD",
      time: "",
      endTime: "",
    });
    expect(formatRsvpDeadline(null)).toBe("—");
  });

  it("formats a date-only string in UTC", () => {
    expect(formatDateString("2027-06-02")).toBe("Jun 2, 2027");
    expect(formatDateString("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("formats relative times as before", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-06-10T12:00:00.000Z"));
    expect(
      [
        "2027-06-10T11:59:40.000Z",
        "2027-06-10T11:15:00.000Z",
        "2027-06-10T02:00:00.000Z",
        "2027-06-09T11:00:00.000Z",
        "2027-06-05T12:00:00.000Z",
        "2027-06-02T09:05:00.000Z",
      ].map(formatRelativeTime),
    ).toEqual([
      "Just now",
      "45 mins ago",
      "10 hrs ago",
      "1 day ago",
      "5 days ago",
      "Jun 2, 2027",
    ]);
  });
});
