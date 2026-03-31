import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import EventService from "@/lib/services/EventService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

interface EventDetailPageProps {
  params: Promise<{ id: string }>;
}

function parseDurationMinutes(duration: string | null) {
  if (!duration) return null;

  const timeMatch = duration.match(/^\s*(\d+):(\d+)(?::\d+)?\s*$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1] ?? 0);
    const minutes = Number(timeMatch[2] ?? 0);
    return hours * 60 + minutes;
  }

  const hourMatch = duration.match(/(\d+)\s*hour/);
  const minuteMatch = duration.match(/(\d+)\s*minute/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const total = hours * 60 + minutes;

  return total > 0 ? total : null;
}

function formatDateTime(startTimestamp: Date | null, duration: string | null) {
  if (!startTimestamp) {
    return { date: "TBD", time: "", endTime: "" };
  }

  const start = new Date(startTimestamp);
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });

  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const durationMinutes = parseDurationMinutes(duration);
  const endTime = durationMinutes
    ? new Date(
        start.getTime() + durationMinutes * 60 * 1000,
      ).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return { date, time, endTime };
}

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const activeOrganizationId = session.session.activeOrganizationId;

  if (!activeOrganizationId) {
    redirect("/");
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    activeOrganizationId,
  );

  if (!membership) {
    redirect("/");
  }

  const event = await EventService.findById(id);

  if (!event || event.organizationId !== activeOrganizationId) {
    redirect("/");
  }

  const { date, time, endTime } = formatDateTime(
    event.startTimestamp ?? null,
    event.duration ?? null,
  );
  const organization = await OrganizationsService.findById(
    event.organizationId,
  );
  const organizers = organization?.name
    ? [organization.name, organization.name]
    : ["Organizer Name", "Organizer Name"];

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
          <BogButton
            variant="primary"
            size="small"
            className="px-10 py-3 text-xl bg-brand-text text-white"
          >
            Register
          </BogButton>
        </div>

        <div className="mt-4 flex flex-wrap items-stretch gap-30 text-paragraph-1 text-grey-text-weak">
          <div className="flex items-start gap-4">
            <BogIcon name="calendar" size={16} />
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
            <BogIcon name="map-pin" size={16} />
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
              <span className="text-paragraph-1">Max Capacity: 100</span>
            </div>
            <div className="flex items-center gap-2">
              <BogIcon name="users" size={16} />
              <span className="text-paragraph-1">
                Registration Deadline: Saturday, June 12th 11:59 pm
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-4 font-paragraph font-semibold text-grey-text-strong pb-4">
            External Links
          </h2>
          <div className="mt-2 flex flex-col gap-6 text-paragraph-1 text-grey-text-strong">
            <a
              href="https://bitsofgood.org/"
              className="block underline underline-offset-2 text-paragraph-1"
            >
              https://bitsofgood.org/
            </a>
            <a
              href="https://hopeforhaiti.com"
              className="block underline underline-offset-2 text-paragraph-1"
            >
              https://hopeforhaiti.com
            </a>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-4 font-paragraph font-semibold text-grey-text-strong pb-4">
            Accessibility Notes
          </h2>
          <p className="mt-2 text-paragraph-1 text-grey-text-strong">
            These are brief notes about accessibility related to the event. This
            might include things like access spots, inclusive initiatives, etc.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-heading-3 font-paragraph font-semibold text-grey-text-strong pb-4">
            Organizer(s)
          </h2>
          <div className="mt-3 space-y-6 text-paragraph-1 text-grey-text-strong">
            {organizers.map((name, index) => (
              <div key={`${name}-${index}`} className="flex items-center gap-4">
                <ProfileAvatar size="md" />
                <span className="text-paragraph-1 text-grey-text-strong">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-16 -mx-4 border-t border-grey-stroke-weak bg-solid-bg-sunken md:-mx-20">
        <div className="px-4 py-10 md:px-20">
          <div className="flex items-center justify-between text-paragraph-2 text-grey-text-weak">
            <div className="flex items-center">
              <img src="/logo.svg" alt="Logo" className="h-6 w-auto" />
              <div className="flex flex-col items-start">
                <img
                  src="/bog.svg"
                  alt="bits of good"
                  className="h-2.5 w-auto pl-1"
                />
                <img src="/sunset.svg" alt="sunset" className="h-3.5 w-auto" />
              </div>
            </div>
            <div className="text-right">
              <div>© 2024 Bits of Good</div>
              <div>bitsofgood.org</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
