"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListBulletsIcon, SquaresFourIcon } from "@phosphor-icons/react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import BogTabs, { type BogTab } from "@/components/bog/BogTabs/BogTabs";
import EventCard from "@/components/EventCard";
import {
  bucketEventsForPage,
  type EventsPageEvent,
} from "@/lib/eventsPageUtils";

type TabId = "all" | "upcoming" | "drafts" | "past";

type Props = {
  events: EventsPageEvent[];
  isAdmin: boolean;
  canCreateEvents: boolean;
};

const ADMIN_TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "upcoming", label: "Upcoming events" },
  { id: "drafts", label: "Drafts" },
  { id: "past", label: "Past events" },
];

const MEMBER_TABS = ADMIN_TABS.filter(({ id }) => id !== "drafts");

function EventSection({
  title,
  events,
  view,
}: {
  title: string;
  events: EventsPageEvent[];
  view: "grid" | "list";
}) {
  if (events.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-11">
      <h2 className="text-heading-3 font-bold text-black">{title}</h2>
      <div
        className={
          view === "grid" ? "flex flex-wrap gap-12" : "flex flex-col gap-12"
        }
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} layout={view} />
        ))}
      </div>
    </section>
  );
}

export default function EventsPageClient({
  events,
  isAdmin,
  canCreateEvents,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryFromUrl = searchParams.get("query") ?? "";
  const rawFilter = searchParams.get("filter");
  const filter =
    rawFilter === "upcoming" ||
    rawFilter === "past" ||
    (isAdmin && rawFilter === "drafts")
      ? rawFilter
      : null;
  const tab: TabId = filter ?? "all";

  const [view, setView] = useState<"grid" | "list">("grid");
  const [queryInput, setQueryInput] = useState(queryFromUrl);
  const [lastSyncedQuery, setLastSyncedQuery] = useState(queryFromUrl);

  if (queryFromUrl !== lastSyncedQuery) {
    setQueryInput(queryFromUrl);
    setLastSyncedQuery(queryFromUrl);
  }

  function replaceUrl(nextQuery: string, nextFilter: TabId | null) {
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery === queryFromUrl && nextFilter === tab) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    if (normalizedQuery) {
      params.set("query", normalizedQuery);
    } else {
      params.delete("query");
    }

    if (nextFilter && nextFilter !== "all") {
      params.set("filter", nextFilter);
    } else {
      params.delete("filter");
    }

    const nextUrl = params.toString();
    router.replace(nextUrl ? `${pathname}?${nextUrl}` : pathname);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    replaceUrl(queryInput, tab);
  }

  const buckets = useMemo(
    () => bucketEventsForPage(events, new Date(), isAdmin),
    [events, isAdmin],
  );

  const showUpcoming =
    tab === "all" ? buckets.upcoming : tab === "upcoming" ? events : [];
  const showDrafts = !isAdmin
    ? []
    : tab === "all"
      ? buckets.drafts
      : tab === "drafts"
        ? events
        : [];
  const showPast = tab === "all" ? buckets.past : tab === "past" ? events : [];

  const tabs = isAdmin ? ADMIN_TABS : MEMBER_TABS;
  const isEmpty =
    showUpcoming.length === 0 &&
    showDrafts.length === 0 &&
    showPast.length === 0;

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

      <BogTabs
        defaultValue={tab}
        value={tab}
        onValueChange={(value) =>
          replaceUrl(queryInput, value === "all" ? null : (value as TabId))
        }
        tabContents={Object.fromEntries(
          tabs.map((t) => [
            t.id,
            { label: t.label, content: null } satisfies BogTab,
          ]),
        )}
        className="mt-16"
      />

      <div className="mt-16 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          className="flex min-h-9 min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-grey-stroke-weak bg-white sm:max-w-xl"
        >
          <label className="flex min-w-0 flex-1 items-center px-3">
            <span className="sr-only">Search events</span>
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Enter text to search"
              className="min-w-0 flex-1 bg-transparent py-2 text-paragraph-2 text-grey-text-strong placeholder:text-grey-text-weak outline-none"
            />
          </label>
          <button
            type="submit"
            className="flex w-10 shrink-0 items-center justify-center border-l border-grey-stroke-weak bg-solid-bg-base"
            aria-label="Search events"
          >
            <BogIcon
              name="search"
              size={18}
              className="text-grey-icon-strong"
            />
          </button>
        </form>

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

      <div className="mt-16 flex flex-col gap-16">
        {isEmpty ? (
          <p className="text-paragraph-1 text-grey-text-weak">
            No events match your filters.
          </p>
        ) : (
          <>
            <EventSection
              title="Upcoming events"
              events={showUpcoming}
              view={view}
            />
            {isAdmin ? (
              <EventSection title="Drafts" events={showDrafts} view={view} />
            ) : null}
            <EventSection title="Past events" events={showPast} view={view} />
          </>
        )}
      </div>
    </div>
  );
}
