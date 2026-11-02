"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import {
  addCalendarDays,
  CALENDAR_DAY_COUNT,
  isSameCalendarDay,
  startOfDashboardWeek,
} from "@/lib/dashboard/calendar";

export type CalendarEvent = {
  id: string;
  name: string;
  startTimestamp: string;
};

function eventTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function WeeklyCalendarClient() {
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const hasInitializedRef = useRef(false);

  const days = useMemo(
    () =>
      weekStart
        ? Array.from({ length: CALENDAR_DAY_COUNT }, (_, offset) =>
            addCalendarDays(weekStart, offset),
          )
        : [],
    [weekStart],
  );

  const loadWeek = useCallback(async (nextStart: Date) => {
    const nextEnd = addCalendarDays(nextStart, 7);
    const requestId = ++requestIdRef.current;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.events.calendar.$get({
        query: {
          start: nextStart.toISOString(),
          end: nextEnd.toISOString(),
        },
      });

      if (!response.ok) throw new Error("Unable to load calendar");
      const result = await response.json();
      if (requestId === requestIdRef.current) setEvents(result.data);
    } catch {
      if (requestId === requestIdRef.current) {
        setEvents([]);
        setErrorMessage("Could not load this week. Please try again.");
      }
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const currentWeekStart = startOfDashboardWeek(new Date());
    // This state must be initialized in the browser because the server does
    // not know the viewer's timezone.
    setWeekStart(currentWeekStart);
    void loadWeek(currentWeekStart);
  }, [loadWeek]);

  function moveWeek(offset: number) {
    if (!weekStart) return;
    const nextStart = addCalendarDays(weekStart, offset * 7);
    setWeekStart(nextStart);
    void loadWeek(nextStart);
  }

  const today = new Date();

  return (
    <section className="flex min-h-full flex-col rounded-xl border border-grey-stroke-weak bg-solid-bg-base p-6 text-page-text">
      <h3 className="text-heading-3 font-semibold">Weekly Calendar</h3>

      {weekStart ? (
        <ol className="mt-5 grid shrink-0 overflow-hidden rounded-lg border border-grey-stroke-weak mobile:grid-cols-5 mobile:divide-x mobile:divide-grey-stroke-weak">
          {days.map((day) => {
            const dayEvents = events.filter((event) =>
              isSameCalendarDay(new Date(event.startTimestamp), day),
            );
            const isToday = isSameCalendarDay(day, today);

            return (
              <li
                key={day.toISOString()}
                aria-current={isToday ? "date" : undefined}
                className={`min-h-50 border-b border-grey-stroke-weak px-5 py-4 last:border-b-0 mobile:border-b-0 mobile:px-2 desktop:px-5 ${
                  isToday ? "bg-brand-fill" : "bg-solid-bg-base"
                }`}
              >
                <div className="text-center">
                  <p className="text-paragraph-1 text-grey-text-weak">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p className="mt-1 text-heading-3 font-semibold">
                    {day.getDate()}
                  </p>
                </div>

                <div className="mt-5 text-mobile-paragraph-2">
                  {isLoading ? (
                    <div
                      role="status"
                      aria-label="Loading calendar"
                      className="h-10 animate-pulse rounded bg-grey-fill-weak"
                    />
                  ) : dayEvents.length === 0 ? (
                    <p className="text-calendar-empty text-grey-text-weak">
                      No events
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {dayEvents.map((event) => (
                        <li key={event.id}>
                          <Link
                            href={`/events/${event.id}`}
                            className="block hover:text-brand-text"
                          >
                            <time
                              className="block text-small text-grey-text-weak"
                              dateTime={event.startTimestamp}
                            >
                              {eventTime(event.startTimestamp)}
                            </time>
                            <span className="text-mobile-paragraph-2 font-normal">
                              {event.name}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div
          role="status"
          aria-label="Loading calendar"
          className="mt-5 h-50 animate-pulse rounded-lg bg-grey-fill-weak"
        />
      )}

      {errorMessage && (
        <p role="status" className="mt-3 text-small text-status-red-text">
          {errorMessage}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={isLoading || !weekStart}
          onClick={() => moveWeek(-1)}
          className="theme-control rounded-full border border-brand-text px-5 py-2 text-paragraph-2 text-brand-text hover:bg-brand-fill disabled:cursor-wait disabled:opacity-50"
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={isLoading || !weekStart}
          onClick={() => moveWeek(1)}
          className="theme-control rounded-full border border-brand-text px-5 py-2 text-paragraph-2 text-brand-text hover:bg-brand-fill disabled:cursor-wait disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </section>
  );
}
