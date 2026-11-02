// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WeeklyCalendarClient, {
  type CalendarEvent,
} from "@/components/dashboard/widgets/WeeklyCalendarClient";
import {
  addCalendarDays,
  startOfDashboardWeek,
} from "@/lib/dashboard/calendar";

const mocks = vi.hoisted(() => ({
  getCalendar: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  default: {
    events: {
      calendar: {
        $get: (args: unknown) => mocks.getCalendar(args),
      },
    },
  },
}));

function eventOn(date: Date, id: string, name: string): CalendarEvent {
  const start = new Date(date);
  start.setHours(10, 0, 0, 0);
  return { id, name, startTimestamp: start.toISOString() };
}

describe("WeeklyCalendarClient", () => {
  beforeEach(() => {
    mocks.getCalendar.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders Monday through Friday, highlights today, and links events", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T15:00:00.000Z"));
    const today = new Date();
    const monday = startOfDashboardWeek(today);
    const event = eventOn(today, "event_today", "Leadership Workshop");

    const { container } = render(
      <WeeklyCalendarClient
        initialWeekStart={monday.toISOString()}
        initialEvents={[event]}
      />,
    );

    expect(screen.getByText("Weekly Calendar")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(container.querySelector('[aria-current="date"]')).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Leadership Workshop/ })
        .getAttribute("href"),
    ).toBe("/events/event_today");
    expect(screen.getAllByText("No events")).toHaveLength(4);
  });

  it("loads the next and previous weeks", async () => {
    const monday = startOfDashboardWeek(new Date());
    const nextMonday = addCalendarDays(monday, 7);
    const nextEvent = eventOn(nextMonday, "event_next", "Mentorship Circles");
    const currentEvent = eventOn(monday, "event_current", "Camp Day");
    mocks.getCalendar
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [nextEvent] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [currentEvent] }),
      });

    render(
      <WeeklyCalendarClient
        initialWeekStart={monday.toISOString()}
        initialEvents={[currentEvent]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next →" }));

    await waitFor(() => {
      expect(screen.getByText("Mentorship Circles")).toBeTruthy();
    });
    expect(mocks.getCalendar).toHaveBeenNthCalledWith(1, {
      query: {
        start: nextMonday.toISOString(),
        end: addCalendarDays(nextMonday, 7).toISOString(),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "← Previous" }));

    await waitFor(() => {
      expect(screen.getByText("Camp Day")).toBeTruthy();
    });
    expect(mocks.getCalendar).toHaveBeenNthCalledWith(2, {
      query: {
        start: monday.toISOString(),
        end: addCalendarDays(monday, 7).toISOString(),
      },
    });
  });
});
