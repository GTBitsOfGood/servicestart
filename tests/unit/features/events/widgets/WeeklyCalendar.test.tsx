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
} from "@/features/events/widgets/WeeklyCalendarClient";
import {
  addCalendarDays,
  startOfDashboardWeek,
} from "@/features/events/lib/calendar";

const mocks = vi.hoisted(() => ({
  getCalendar: vi.fn(),
  activeOrganization: {
    data: null as { id: string } | null,
  },
}));

vi.mock("@/core/api/client", () => ({
  default: {
    events: {
      calendar: {
        $get: (args: unknown) => mocks.getCalendar(args),
      },
    },
  },
}));

vi.mock("@/core/tenant/hooks/useActiveOrganization", () => ({
  useActiveOrganization: () => ({ organization: mocks.activeOrganization }),
}));

function eventOn(date: Date, id: string, name: string): CalendarEvent {
  const start = new Date(date);
  start.setHours(10, 0, 0, 0);
  return { id, name, startTimestamp: start.toISOString() };
}

describe("WeeklyCalendarClient", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    mocks.getCalendar.mockReset();
    mocks.activeOrganization.data = { id: "org_current" };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it("calculates Monday through Friday in the browser timezone", async () => {
    process.env.TZ = "America/New_York";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T15:00:00.000Z"));
    const today = new Date();
    const event = eventOn(today, "event_today", "Leadership Workshop");
    mocks.getCalendar.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [event] }),
    });

    const { container } = render(<WeeklyCalendarClient />);

    expect(screen.getByText("Weekly Calendar")).toBeTruthy();
    await waitFor(() => {
      expect(
        screen
          .getByRole("link", { name: /Leadership Workshop/ })
          .getAttribute("href"),
      ).toBe("/events/event_today");
    });
    expect(screen.getByText("Leadership Workshop").className).toContain(
      "text-mobile-paragraph-2",
    );
    expect(screen.getByText("Leadership Workshop").className).toContain(
      "font-normal",
    );
    expect(mocks.getCalendar).toHaveBeenCalledWith({
      query: {
        start: "2026-11-02T05:00:00.000Z",
        end: "2026-11-09T05:00:00.000Z",
      },
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(container.querySelector('[aria-current="date"]')).toBeTruthy();
    const emptyDays = screen.getAllByText("No events");
    expect(emptyDays).toHaveLength(4);
    expect(
      emptyDays.every((label) =>
        label.classList.contains("text-calendar-empty"),
      ),
    ).toBe(true);
  });

  it("loads the next and previous weeks", async () => {
    const monday = startOfDashboardWeek(new Date());
    const nextMonday = addCalendarDays(monday, 7);
    const nextEvent = eventOn(nextMonday, "event_next", "Mentorship Circles");
    const currentEvent = eventOn(monday, "event_current", "Camp Day");
    mocks.getCalendar
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [currentEvent] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [nextEvent] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [currentEvent] }),
      });

    render(<WeeklyCalendarClient />);

    await waitFor(() => {
      expect(screen.getByText("Camp Day")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next →" }));

    await waitFor(() => {
      expect(screen.getByText("Mentorship Circles")).toBeTruthy();
    });
    expect(mocks.getCalendar).toHaveBeenNthCalledWith(2, {
      query: {
        start: nextMonday.toISOString(),
        end: addCalendarDays(nextMonday, 7).toISOString(),
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "← Previous" }));

    await waitFor(() => {
      expect(screen.getByText("Camp Day")).toBeTruthy();
    });
    expect(mocks.getCalendar).toHaveBeenNthCalledWith(3, {
      query: {
        start: monday.toISOString(),
        end: addCalendarDays(monday, 7).toISOString(),
      },
    });
  });

  it("waits for the active organization and reloads when it changes", async () => {
    mocks.activeOrganization.data = null;
    mocks.getCalendar.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { rerender } = render(<WeeklyCalendarClient />);

    expect(mocks.getCalendar).not.toHaveBeenCalled();

    mocks.activeOrganization.data = { id: "org_first" };
    rerender(<WeeklyCalendarClient />);

    await waitFor(() => expect(mocks.getCalendar).toHaveBeenCalledTimes(1));

    mocks.activeOrganization.data = { id: "org_second" };
    rerender(<WeeklyCalendarClient />);

    await waitFor(() => expect(mocks.getCalendar).toHaveBeenCalledTimes(2));
  });
});
