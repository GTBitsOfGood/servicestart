"use client";
import { useRouter } from "next/navigation";
import type { InferSelectModel } from "drizzle-orm";
import { events } from "@/lib/schema";

export type Event = InferSelectModel<typeof events>;

export default function EventCard({ event }: { event: Event }) {
  const router = useRouter();

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

  return (
    <div className="w-[230px] min-w-[230px] flex flex-col">
      <div
        className="w-full h-[145px] bg-[#D9D9D9] rounded-xl mb-3 bg-cover bg-center"
        style={{
          backgroundImage: event.coverImageUrl
            ? `url(${event.coverImageUrl})`
            : undefined,
        }}
      />
      <div className="flex flex-col gap-2">
        <div className="text-paragraph-2 font-bold text-black text-[18px]">
          {event.name}
        </div>
        <div className="text-small font-semibold text-black text-[15px]">
          {date}
          {time ? ` • ${time}` : ""}
        </div>
        <div className="text-small text-black text-[15px]">
          {event.organizationId}
        </div>
        <div className="text-small text-black text-[14px]">
          {event.location}
        </div>
        <button
          onClick={() => router.push(`/event/${event.id}`)}
          className="text-small bg-transparent border-none p-0 text-[rgba(34,7,11,0.50)] cursor-pointer flex items-center gap-1 w-fit text-[14px]"
        >
          View details <span className="text-[14px]">{">"}</span>
        </button>
      </div>
    </div>
  );
}
