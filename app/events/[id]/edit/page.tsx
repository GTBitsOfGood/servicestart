import { redirect } from "next/navigation";
import EditEventClient from "@/components/events/EditEventClient";
import { redirectIfNotAdmin } from "@/lib/authUtils";
import EventService from "@/lib/services/EventService";
import { UserService } from "@/lib/services/UserService";
import { formValuesFromEvent } from "@/lib/eventFormUtils";

interface EditEventPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const session = await redirectIfNotAdmin();
  const { id } = await params;

  const event = await EventService.findById(id);
  if (!event || event.organizationId !== session.organizationId) {
    redirect("/events");
  }

  const hostRecords = await EventService.listEventHosts(event.id);
  const hostUsers = await Promise.all(
    hostRecords.map((host) => UserService.findById(host.userId)),
  );
  const hostEmails = hostUsers.flatMap((user) =>
    user?.email ? [user.email] : [],
  );

  const initialValues = formValuesFromEvent({
    name: event.name,
    location: event.location,
    description: event.description,
    startTimestamp: event.startTimestamp
      ? event.startTimestamp.toISOString()
      : null,
    duration: event.duration,
    rsvpLimit: event.rsvpLimit,
    rsvpDeadline: event.rsvpDeadline ? event.rsvpDeadline.toISOString() : null,
    visibility: event.visibility,
    accessibilityNotes: event.accessibilityNotes,
    links: event.links,
    tagIds: event.tags.map((tag) => tag.tagId),
    hosts: hostEmails,
  });

  return (
    <EditEventClient
      eventId={event.id}
      initialValues={initialValues}
      isPublished={event.publishedAt != null}
    />
  );
}
