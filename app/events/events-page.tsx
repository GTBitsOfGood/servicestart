"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListBulletsIcon, SquaresFourIcon } from "@phosphor-icons/react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import EventCard from "@/components/EventCard";
import type { EventsPageEvent } from "@/lib/eventsPageUtils";

type TabId = "all" | "upcoming" | "drafts" | "past";

type Props = {
  upcoming: EventsPageEvent[];
  drafts: EventsPageEvent[];
  past: EventsPageEvent[];
  isAdmin: boolean;
  canCreateEvents: boolean;
};

function matchesSearch(event: EventsPageEvent, q: string) {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  return (
    event.name.toLowerCase().includes(n) ||
    event.location.toLowerCase().includes(n)
  );
}

export default function EventsPageClient({
  upcoming: upcomingIn,
  drafts: draftsIn,
  past: pastIn,
  isAdmin,
  canCreateEvents,
}: Props) {
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const upcoming = useMemo(
    () => upcomingIn.filter((e) => matchesSearch(e, query)),
    [upcomingIn, query],
  );
  const drafts = useMemo(
    () => draftsIn.filter((e) => matchesSearch(e, query)),
    [draftsIn, query],
  );
  const past = useMemo(
    () => pastIn.filter((e) => matchesSearch(e, query)),
    [pastIn, query],
  );

  const totalVisible = upcomingIn.length + draftsIn.length + pastIn.length;
  const tabCounts = {
    all: totalVisible,
    upcoming: upcomingIn.length,
    drafts: draftsIn.length,
    past: pastIn.length,
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "all", label: "All events" },
    { id: "upcoming", label: "Upcoming events" },
    ...(isAdmin ? [{ id: "drafts" as const, label: "Drafts" }] : []),
    { id: "past", label: "Past events" },
  ];

  const showUpcoming = tab === "all" || tab === "upcoming" ? upcoming : [];
  const showDrafts =
    isAdmin && (tab === "all" || tab === "drafts") ? drafts : [];
  const showPast = tab === "all" || tab === "past" ? past : [];

  const gridClass =
    view === "grid"
      ? "flex flex-wrap gap-x-12 gap-y-10"
      : "flex flex-col gap-6";

  function Section({
    title,
    events,
  }: {
    title: string;
    events: EventsPageEvent[];
  }) {
    if (events.length === 0) return null;
    return (
      <section className="flex w-full flex-col gap-11">
        <h2 className="text-heading-3 font-bold text-black">
          {title} [{events.length}]
        </h2>
        <div className={gridClass}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} layout={view} />
          ))}
        </div>
      </section>
    );
  }

  const emptyAll =
    tab === "all" &&
    showUpcoming.length === 0 &&
    showDrafts.length === 0 &&
    showPast.length === 0;

  const emptyTab =
    (tab === "upcoming" && upcoming.length === 0) ||
    (tab === "drafts" && drafts.length === 0) ||
    (tab === "past" && past.length === 0);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-16 pt-8 md:px-12 lg:px-24">
      <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-heading-1 font-bold text-grey-text-strong">
          Events
        </h1>
        {canCreateEvents ? (
          <Link
            href="/"
            className="inline-flex shrink-0 items-center justify-center rounded bg-brand-text px-4 py-2 text-center text-paragraph-1 font-semibold text-white hover:opacity-90"
          >
            Create event
          </Link>
        ) : null}
      </div>

      <div
        className="mt-10 flex flex-wrap gap-2 border-b border-grey-stroke-weak md:gap-8"
        role="tablist"
        aria-label="Event filters"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative pb-3 pl-1 pr-1 text-paragraph-2 ${
                active
                  ? "font-semibold text-grey-text-strong"
                  : "font-normal text-grey-text-weak"
              }`}
            >
              {t.label} [{tabCounts[t.id]}]
              {active ? (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-grey-text-strong" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-h-9 min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-grey-stroke-weak bg-white sm:max-w-xl">
          <label className="flex min-w-0 flex-1 items-center px-3">
            <span className="sr-only">Search events</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter text to search"
              className="min-w-0 flex-1 bg-transparent py-2 text-paragraph-2 text-grey-text-strong placeholder:text-grey-text-weak outline-none"
            />
          </label>
          <div
            className="flex w-10 shrink-0 items-center justify-center border-l border-grey-stroke-weak bg-solid-bg-base"
            aria-hidden
          >
            <BogIcon
              name="search"
              size={18}
              className="text-grey-icon-strong"
            />
          </div>
        </div>

        <div
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#efeded] p-1.5"
          role="group"
          aria-label="Layout"
        >
          <button
            type="button"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`rounded-full p-1.5 ${
              view === "grid" ? "bg-white shadow-sm" : ""
            }`}
          >
            <SquaresFourIcon
              size={20}
              weight="bold"
              className="text-grey-text-strong"
              aria-hidden
            />
            <span className="sr-only">Grid view</span>
          </button>
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`rounded-full p-1.5 ${
              view === "list" ? "bg-white shadow-sm" : ""
            }`}
          >
            <ListBulletsIcon
              size={20}
              weight="bold"
              className="text-grey-text-strong"
              aria-hidden
            />
            <span className="sr-only">List view</span>
          </button>
        </div>
      </div>

      <div className="mt-14 flex flex-col gap-16">
        {emptyAll || emptyTab ? (
          <p className="text-paragraph-1 text-grey-text-weak">
            No events match your filters.
          </p>
        ) : (
          <>
            <Section title="Upcoming events" events={showUpcoming} />
            {isAdmin ? <Section title="Drafts" events={showDrafts} /> : null}
            <Section title="Past events" events={showPast} />
          </>
        )}
      </div>
    </div>
  );
}
