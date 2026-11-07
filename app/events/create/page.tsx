"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/core/auth/authClient";
import { useActiveOrganization } from "@/core/tenant/hooks/useActiveOrganization";
import { isAdmin } from "@/core/utils/clientUtils";
import api from "@/core/api/client";
import EventForm, {
  type SubmitIntent,
} from "@/features/events/components/EventForm";
import {
  emptyEventFormValues,
  type EventPayload,
} from "@/features/events/lib/eventFormUtils";

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
