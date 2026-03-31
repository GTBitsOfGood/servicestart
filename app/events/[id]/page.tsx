import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import RegisterButton from "@/components/events/RegisterButton";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import EventService from "@/lib/services/EventService";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { UserService } from "@/lib/services/UserService";
import { formatDateTime, formatRsvpDeadline } from "@/lib/clientUtils";

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const { id } = await params;
  const event = await EventService.findById(id);

  if (!event) {
    redirect("/");
  }

  const activeOrganizationId = session.session.activeOrganizationId;
  const eventVisibility = (event as { visibility?: string | null }).visibility;
  const isPublicEvent = eventVisibility === "public";

  if (!isPublicEvent) {
    if (!session?.user) {
      redirect("/login");
    }

    if (!activeOrganizationId) {
      redirect("/");
    }

    if (event.organizationId !== activeOrganizationId) {
      redirect("/");
    }

    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      activeOrganizationId,
    );

    if (!membership) {
      redirect("/");
    }
  }

  const { date, time, endTime } = formatDateTime(
    event.startTimestamp ?? null,
    event.duration ?? null,
  );
  const organization = await OrganizationsService.findById(
    event.organizationId,
  );
  const hostRecord = await EventService.getEventHosts(event.id);
  const hostIds = hostRecord ? [hostRecord.userId] : [];
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

  const eventMeta = event as {
    rsvpLimit?: number | null;
    rsvpDeadline?: Date | null;
    accessibilityNotes?: string | null;
    links?: string[] | null;
  };
  const rsvpLimit = eventMeta.rsvpLimit ?? null;
  const rsvpDeadline = eventMeta.rsvpDeadline ?? null;
  const accessibilityNotes = eventMeta.accessibilityNotes ?? null;
  const links = eventMeta.links ?? [];
  const rsvps = await EventService.listRSVPsByEvent(event.id);
  const rsvpCount = rsvps.length;
  const userHasRsvped = rsvps.some(
    (rsvp: { userId: string }) => rsvp.userId === session.user.id,
  );
  const isFull = rsvpLimit !== null && rsvpCount >= rsvpLimit;
  const isDeadlinePassed = rsvpDeadline ? new Date() > rsvpDeadline : false;
  const initialRegisterState = {
    registered: userHasRsvped,
    isFull,
    isDeadlinePassed,
  };

  async function registerForEvent() {
    "use server";

    const authSession = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authSession?.user) {
      redirect("/login");
    }

    const activeOrganizationId = authSession.session.activeOrganizationId;
    if (!activeOrganizationId) {
      redirect("/");
    }

    const membership = await MembersService.findByUserAndOrganization(
      authSession.user.id,
      activeOrganizationId,
    );

    if (!membership) {
      redirect("/");
    }

    const eventRecord = await EventService.findById(id);
    if (!eventRecord || eventRecord.organizationId !== activeOrganizationId) {
      redirect("/");
    }

    const recordMeta = eventRecord as {
      rsvpLimit?: number | null;
      rsvpDeadline?: Date | null;
    };
    const recordRsvpLimit = recordMeta.rsvpLimit ?? null;
    const recordRsvpDeadline = recordMeta.rsvpDeadline ?? null;
    const currentRsvps = await EventService.listRSVPsByEvent(eventRecord.id);
    const recordIsFull =
      recordRsvpLimit !== null && currentRsvps.length >= recordRsvpLimit;
    const recordDeadlinePassed = recordRsvpDeadline
      ? new Date() > recordRsvpDeadline
      : false;

    const alreadyRsvped = currentRsvps.some(
      (rsvp: { userId: string }) => rsvp.userId === authSession.user.id,
    );

    if (alreadyRsvped) {
      await EventService.deleteRSVP(eventRecord.id, authSession.user.id);
      const remainingRsvps = await EventService.listRSVPsByEvent(
        eventRecord.id,
      );
      const remainingCount = remainingRsvps.length;
      const remainingIsFull =
        recordRsvpLimit !== null && remainingCount >= recordRsvpLimit;
      const remainingDeadlinePassed = recordRsvpDeadline
        ? new Date() > recordRsvpDeadline
        : false;
      return {
        registered: false,
        isFull: remainingIsFull,
        isDeadlinePassed: remainingDeadlinePassed,
      };
    }

    if (recordIsFull || recordDeadlinePassed) {
      return {
        registered: false,
        isFull: recordIsFull,
        isDeadlinePassed: recordDeadlinePassed,
      };
    }

    await EventService.addRSVP(eventRecord.id, authSession.user.id);

    const updatedRsvps = await EventService.listRSVPsByEvent(eventRecord.id);
    const updatedCount = updatedRsvps.length;
    const updatedIsFull =
      recordRsvpLimit !== null && updatedCount >= recordRsvpLimit;
    const updatedDeadlinePassed = recordRsvpDeadline
      ? new Date() > recordRsvpDeadline
      : false;
    return {
      registered: true,
      isFull: updatedIsFull,
      isDeadlinePassed: updatedDeadlinePassed,
    };
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

        <div className="flex items-center justify-between my-16">
          <h1 className="text-heading-1 font-paragraph font-bold text-grey-text-strong">
            {event.name}
          </h1>
          <RegisterButton
            initialState={initialRegisterState}
            onRegister={registerForEvent}
          />
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
            {["Tag placeholder"].map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="rounded-lg px-3 py-1 text-paragraph-2 text-notif-announcement bg-notif-announcement-bg"
              >
                {tag}
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
