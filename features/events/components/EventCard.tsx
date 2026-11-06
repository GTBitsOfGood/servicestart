import Link from "next/link";
import type { InferSelectModel } from "drizzle-orm";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { events } from "@/lib/schema";

export type Event = Omit<InferSelectModel<typeof events>, "startTimestamp"> & {
  startTimestamp: string | null;
};

export type EventCardEvent = Pick<
  Event,
  "id" | "name" | "location" | "coverImageUrl" | "startTimestamp"
>;

export default function EventCard({
  event,
  layout = "grid",
}: {
  event: EventCardEvent;
  layout?: "grid" | "list";
}) {
  const date = event.startTimestamp
    ? new Date(event.startTimestamp).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
      })
    : "TBD";
  const time = event.startTimestamp
    ? new Date(event.startTimestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const dateTime = time && date !== "TBD" ? `${date} • ${time}` : date;

  if (layout === "list") {
    return (
      <article className="flex w-full items-center justify-between gap-6">
        <div className="flex items-stretch gap-5">
          <div
            className="h-[85px] w-[130px] shrink-0 rounded-xl bg-grey-fill-weaker bg-cover bg-center"
            style={{
              backgroundImage: event.coverImageUrl
                ? `url(${event.coverImageUrl})`
                : undefined,
            }}
          />
          <div className="flex min-w-0 flex-col justify-between py-1">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="text-heading-4 text-black">{event.name}</div>
              <div className="text-paragraph-1 font-semibold text-black">
                {dateTime}
              </div>
            </div>
            <div className="text-paragraph-2 text-black">{event.location}</div>
          </div>
        </div>
        <Link
          href={`/events/${event.id}`}
          className="inline-flex shrink-0 items-center gap-1 pb-2 text-paragraph-2 font-semibold text-black/50 hover:text-grey-text-strong"
        >
          View details
          <BogIcon name="chevron-right" size={18} className="text-black/50" />
        </Link>
      </article>
    );
  }

  return (
    <article className="flex w-full max-w-[280px] flex-col gap-4">
      <div
        className="h-[190px] w-full shrink-0 rounded-xl bg-grey-fill-weaker bg-cover bg-center"
        style={{
          backgroundImage: event.coverImageUrl
            ? `url(${event.coverImageUrl})`
            : undefined,
        }}
      />
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="text-heading-4 text-black">{event.name}</div>
          <div className="text-paragraph-2 font-semibold text-black">
            {dateTime}
          </div>
        </div>
        <div className="text-paragraph-2 text-black">{event.location}</div>
        <Link
          href={`/events/${event.id}`}
          className="inline-flex w-fit items-center gap-1 pb-2 text-paragraph-2 font-semibold text-black/50 hover:text-grey-text-strong"
        >
          View details
          <BogIcon name="chevron-right" size={18} className="text-black/50" />
        </Link>
      </div>
    </article>
  );
}
