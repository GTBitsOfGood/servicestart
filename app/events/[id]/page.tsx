import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import RegisterButton, {
  type RegisterState,
} from "@/components/events/RegisterButton";
import EventAdminActions from "@/components/events/EventAdminActions";
import DraftChip from "@/components/events/DraftChip";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import EventService from "@/lib/services/EventService";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { UserService } from "@/lib/services/UserService";
import { formatDateTime, formatRsvpDeadline } from "@/lib/clientUtils";
import {
  canManageEvent,
  canViewEvent,
  registrationBlockMessages,
  validateReadyToPublish,
  type Viewer,
} from "@/lib/events";

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

async function resolveViewer(): Promise<{
  userId: string | null;
  viewer: Viewer;
}> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return {
      userId: null,
      viewer: { organizationId: null, isMember: false, isAdmin: false },
    };
  }

  const organizationId = session.session.activeOrganizationId ?? null;
  const membership = organizationId
    ? await MembersService.findByUserAndOrganization(
        session.user.id,
        organizationId,
      )
    : null;

  return {
    userId: session.user.id,
    viewer: {
      organizationId,
      isMember: membership != null,
      isAdmin: MembersService.isAdminOrOwner(membership?.role),
    },
  };
}

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const { id } = await params;
  const { userId, viewer } = await resolveViewer();
  const event = await EventService.findById(id);

  if (!event || !canViewEvent(event, viewer)) {
    redirect(userId ? "/events" : "/login");
  }

  const isAdminForEvent = canManageEvent(event, viewer);
  const isDraft = event.publishedAt == null;

  const { date, time, endTime } = formatDateTime(
    event.startTimestamp ?? null,
    event.duration ?? null,
  );
  const organization = await OrganizationsService.findById(
    event.organizationId,
  );
  const hostRecords = await EventService.listEventHosts(event.id);
  const hostIds = hostRecords.map((host) => host.userId);
  const hostUsers = await Promise.all(hostIds.map(UserService.findById));
  const organizerProfiles = hostUsers.flatMap(
    (
      user: {
        displayName?: string | null;
        name?: string | null;
        email?: string | null;
        image?: string | null;
      } | null,
    ) => {
      if (!user) return [];
      return [
        {
          name: user.displayName ?? user.name ?? user.email ?? "Organizer",
          image: user.image ?? null,
        },
      ];
    },
  );
  const organizers = organizerProfiles.length
    ? organizerProfiles
    : organization?.name
      ? [{ name: organization.name, image: null }]
      : [{ name: "Organizer Name", image: null }];

  const rsvpLimit = event.rsvpLimit;
  const rsvpDeadline = event.rsvpDeadline;
  const accessibilityNotes = event.accessibilityNotes;
  const links = event.links ?? [];
  const tagList = event.tags ?? [];
  const rsvpCount = await EventService.countRSVPs(event.id);
  const userHasRsvped = userId
    ? await EventService.hasRSVP(event.id, userId)
    : false;
  const isFull = rsvpLimit !== null && rsvpCount >= rsvpLimit;
  const isDeadlinePassed = rsvpDeadline ? new Date() > rsvpDeadline : false;
  const initialRegisterState: RegisterState = {
    registered: userHasRsvped,
    isFull,
    isDeadlinePassed,
  };

  // Rules come from lib/events so this stays in step with the RSVP route.
  async function registerForEvent(): Promise<RegisterState> {
    "use server";

    const { userId: actorId, viewer: actor } = await resolveViewer();

    if (!actorId) {
      redirect("/login");
    }

    const eventRecord = await EventService.findById(id);
    if (!eventRecord || !canViewEvent(eventRecord, actor)) {
      redirect("/events");
    }

    const organizationId = eventRecord.organizationId;

    async function stateAfter(message?: string): Promise<RegisterState> {
      const count = await EventService.countRSVPs(eventRecord!.id);
      return {
        registered: await EventService.hasRSVP(eventRecord!.id, actorId!),
        isFull:
          eventRecord!.rsvpLimit !== null && count >= eventRecord!.rsvpLimit,
        isDeadlinePassed: eventRecord!.rsvpDeadline
          ? new Date() > eventRecord!.rsvpDeadline
          : false,
        message,
      };
    }

    if (actor.organizationId !== organizationId) {
      return await stateAfter(registrationBlockMessages["not-a-member"]);
    }

    const registered = await EventService.hasRSVP(eventRecord.id, actorId);
    const result = registered
      ? await EventService.withdraw(eventRecord.id, organizationId, actorId)
      : await EventService.register(eventRecord.id, organizationId, actorId);

    revalidatePath(`/events/${eventRecord.id}`);

    const succeeded =
      result === "added" ||
      result === "already-registered" ||
      result === "removed";

    return await stateAfter(
      succeeded ? undefined : registrationBlockMessages[result],
    );
  }

  async function setPublished(publish: boolean) {
    "use server";

    const { userId: actorId, viewer: actor } = await resolveViewer();
    const eventRecord = await EventService.findById(id);

    if (!actorId || !eventRecord || !canManageEvent(eventRecord, actor)) {
      return { ok: false, error: "You cannot change this event." };
    }

    if (publish) {
      const publishError = validateReadyToPublish(eventRecord);
      if (publishError) {
        return { ok: false, error: publishError };
      }
    }

    await EventService.updateEvent(eventRecord.id, eventRecord.organizationId, {
      publishedAt: publish ? new Date() : null,
      publishedById: publish ? actorId : null,
    });

    revalidatePath("/events");
    revalidatePath(`/events/${eventRecord.id}`);

    return { ok: true };
  }

  async function deleteEvent() {
    "use server";

    const { userId: actorId, viewer: actor } = await resolveViewer();
    const eventRecord = await EventService.findById(id);

    if (!actorId || !eventRecord || !canManageEvent(eventRecord, actor)) {
      return { ok: false, error: "You cannot delete this event." };
    }

    await EventService.deleteById(eventRecord.id, eventRecord.organizationId);
    revalidatePath("/events");
    redirect("/events");
  }

  return (
    <div className="min-h-screen w-full px-4 pt-6 md:px-20 md:pt-10 flex flex-col">
      <div className="flex-1 pb-10">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 font-bold text-paragraph-1 text-grey-text-strong my-12"
        >
          <BogIcon name="arrow-left" size={14} />
          Back to Events
        </Link>

        <div className="mt-6">
          {event.coverImageUrl ? (
            <img
              src={event.coverImageUrl}
              alt={event.name}
              className="w-full h-110 rounded-xl object-cover"
            />
          ) : (
            <div className="w-full h-110 rounded-lg bg-grey-fill-weaker" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-6 my-16">
          <div className="flex items-center gap-4">
            <h1 className="text-heading-1 font-paragraph font-bold text-grey-text-strong">
              {event.name}
            </h1>
            {isDraft && <DraftChip />}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {isAdminForEvent && (
              <EventAdminActions
                eventId={event.id}
                isPublished={!isDraft}
                onTogglePublish={setPublished}
                onDelete={deleteEvent}
              />
            )}
            {viewer.isMember &&
              viewer.organizationId === event.organizationId &&
              !isDraft && (
                <RegisterButton
                  initialState={initialRegisterState}
                  onRegister={registerForEvent}
                />
              )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-stretch gap-30 text-paragraph-1 text-grey-text-weak">
          <div className="flex items-start gap-4">
            <BogIcon name="calendar" size={20} className="mt-1" />
            <span className="flex flex-col">
              <span className="text-paragraph-1">{date}</span>
              {time ? (
                <span className="text-paragraph-1">
                  {endTime ? `${time} - ${endTime} EST` : time}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex gap-4">
            <BogIcon name="map-pin" size={20} className="mt-1" />
            <span className="text-paragraph-1">{event.location}</span>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-3 font-paragraph font-bold text-grey-text-strong pb-4">
            Description
          </h2>
          <p className="mt-2 text-paragraph-1 text-grey-text-weak">
            {event.description || "No description provided."}
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-3 font-paragraph font-bold text-grey-text-strong pb-4">
            Tags
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {tagList.map((tag) => (
              <span
                key={tag.tagId}
                className="rounded-lg px-3 py-1 text-paragraph-2 text-notif-announcement bg-notif-announcement-bg"
              >
                {tag.tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-3 font-paragraph font-bold text-grey-text-strong pb-4">
            Additional Details
          </h2>
          <div className="mt-3 space-y-3 text-paragraph-1 text-grey-text-weak">
            <div className="flex items-center gap-2">
              <BogIcon name="users" size={16} />
              <span className="text-paragraph-1">
                Max Capacity: {rsvpLimit ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BogIcon name="users" size={16} />
              <span className="text-paragraph-1">
                Registration Deadline: {formatRsvpDeadline(rsvpDeadline)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-4 font-paragraph font-semibold text-grey-text-strong pb-4">
            External Links
          </h2>
          <div className="mt-2 flex flex-col gap-6 text-paragraph-1 text-grey-text-strong">
            {links.length > 0 ? (
              links.map((link) => (
                <a
                  key={link}
                  href={link}
                  className="block underline underline-offset-2 text-paragraph-1"
                >
                  {link}
                </a>
              ))
            ) : (
              <span>—</span>
            )}
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-4 font-paragraph font-semibold text-grey-text-strong pb-4">
            Accessibility Notes
          </h2>
          <p className="mt-2 text-paragraph-1 text-grey-text-strong">
            {accessibilityNotes ??
              "These are brief notes about accessibility related to the event. This might include things like access spots, inclusive initiatives, etc."}
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-3 font-paragraph font-semibold text-grey-text-strong pb-4">
            Organizer(s)
          </h2>
          <div className="mt-3 space-y-6 text-paragraph-1 text-grey-text-strong">
            {organizers.map(
              (
                organizer: { name: string; image: string | null },
                index: number,
              ) => {
                const avatarStyle = organizer.image
                  ? ({
                      "--avatar-url": `url(${organizer.image})`,
                    } as CSSProperties)
                  : undefined;

                return (
                  <div
                    key={`${organizer.name}-${index}`}
                    className="flex items-center gap-4"
                  >
                    <div style={avatarStyle}>
                      <ProfileAvatar
                        size="md"
                        className={
                          organizer.image
                            ? "bg-(image:--avatar-url) bg-cover bg-center"
                            : undefined
                        }
                      />
                    </div>
                    <span className="text-paragraph-1 text-grey-text-strong">
                      {organizer.name}
                    </span>
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
