"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import type { SubmitIntent } from "@/components/events/EventForm";
import {
  formValuesFromEvent,
  type EventFormSource,
  type EventPayload,
} from "@/lib/eventFormUtils";

// Times are shown in the browser's timezone, so the form cannot be server-rendered.
const EventForm = dynamic(() => import("@/components/events/EventForm"), {
  ssr: false,
});

type EditEventClientProps = {
  eventId: string;
  event: EventFormSource;
  isPublished: boolean;
};

export default function EditEventClient({
  eventId,
  event,
  isPublished,
}: EditEventClientProps) {
  const router = useRouter();

  async function handleSubmit(payload: EventPayload, intent: SubmitIntent) {
    const response = await api.events[":eventId"].$patch({
      param: { eventId },
      json: { ...payload, published: intent === "publish" },
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      return {
        ok: false,
        error: data.error || "An error occurred while saving the event.",
      };
    }

    router.push(`/events/${eventId}`);
    router.refresh();
    return { ok: true };
  }

  return (
    <EventForm
      heading={isPublished ? "Edit Event" : "Edit Draft"}
      initialValues={formValuesFromEvent(event)}
      isPublished={isPublished}
      onSubmit={handleSubmit}
      onCancel={() => router.push(`/events/${eventId}`)}
    />
  );
}
