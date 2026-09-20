"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { isAdmin } from "@/lib/clientUtils";
import api from "@/lib/api";
import EventForm, { type SubmitIntent } from "@/components/events/EventForm";
import { emptyEventFormValues, type EventPayload } from "@/lib/eventFormUtils";

export default function EventsCreationPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const { organization } = useActiveOrganization();
  const currentEmail = session?.data?.user?.email;

  async function handleSubmit(payload: EventPayload, intent: SubmitIntent) {
    const hosts =
      currentEmail && !payload.hosts.includes(currentEmail)
        ? [currentEmail, ...payload.hosts]
        : payload.hosts;

    const response = await api.events.$post({
      json: { ...payload, hosts, published: intent === "publish" },
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      return {
        ok: false,
        error: data.error || "An error occurred while creating the event.",
      };
    }

    const data = await response.json();
    router.push(`/events/${data.id}`);
    return { ok: true };
  }

  useEffect(() => {
    if (session?.isPending || organization?.isPending) {
      return;
    }

    if (
      !session?.data?.user ||
      !organization?.data ||
      !isAdmin(organization.data, session.data.user)
    ) {
      router.push("/");
    }
  }, [
    session?.data?.user,
    organization?.data,
    session?.isPending,
    organization?.isPending,
    router,
  ]);

  return (
    <EventForm
      heading="Event Creation Form"
      initialValues={emptyEventFormValues}
      isPublished={false}
      onSubmit={handleSubmit}
      onCancel={() => router.push("/events")}
    />
  );
}
