"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import {
  addCalendarDays,
  CALENDAR_DAY_COUNT,
  isSameCalendarDay,
} from "@/lib/dashboard/calendar";

export type CalendarEvent = {
  id: string;
  name: string;
  startTimestamp: string;
};

type WeeklyCalendarClientProps = {
  initialWeekStart: string;
  initialEvents: CalendarEvent[];
};

function eventTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function WeeklyCalendarClient({
  initialWeekStart,
  initialEvents,
}: WeeklyCalendarClientProps) {
  const [weekStart, setWeekStart] = useState(() => new Date(initialWeekStart));
  const [events, setEvents] = useState(initialEvents);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const days = useMemo(
    () =>
      Array.from({ length: CALENDAR_DAY_COUNT }, (_, offset) =>
        addCalendarDays(weekStart, offset),
      ),
    [weekStart],
  );

  async function moveWeek(offset: number) {
    const nextStart = addCalendarDays(weekStart, offset * 7);
    const nextEnd = addCalendarDays(nextStart, 7);
    const requestId = ++requestIdRef.current;

    setWeekStart(nextStart);
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
  }

  const today = new Date();

  return (
    <section className="flex min-h-full flex-col rounded-xl border border-grey-stroke-weak bg-solid-bg-base p-6 text-page-text">
      <h3 className="text-heading-3 font-semibold">Weekly Calendar</h3>

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

              <div className="mt-5 text-paragraph-2">
                {isLoading ? (
                  <div
                    role="status"
                    aria-label="Loading calendar"
                    className="h-10 animate-pulse rounded bg-grey-fill-weak"
                  />
                ) : dayEvents.length === 0 ? (
                  <p className="text-grey-text-weak">No events</p>
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
                          <span className="font-semibold">{event.name}</span>
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

      {errorMessage && (
        <p role="status" className="mt-3 text-small text-status-red-text">
          {errorMessage}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void moveWeek(-1)}
          className="theme-control rounded-full border border-brand-text px-5 py-2 text-paragraph-2 text-brand-text hover:bg-brand-fill disabled:cursor-wait disabled:opacity-50"
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => void moveWeek(1)}
          className="theme-control rounded-full border border-brand-text px-5 py-2 text-paragraph-2 text-brand-text hover:bg-brand-fill disabled:cursor-wait disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </section>
  );
}
