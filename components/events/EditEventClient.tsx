"use client";

import { useRouter } from "next/navigation";
import api from "@/lib/api";
import EventForm, { type SubmitIntent } from "@/components/events/EventForm";
import type { EventFormValues, EventPayload } from "@/lib/eventFormUtils";

type EditEventClientProps = {
  eventId: string;
  initialValues: EventFormValues;
  isPublished: boolean;
};

export default function EditEventClient({
  eventId,
  initialValues,
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
      initialValues={initialValues}
      isPublished={isPublished}
      onSubmit={handleSubmit}
      onCancel={() => router.push(`/events/${eventId}`)}
    />
  );
}
