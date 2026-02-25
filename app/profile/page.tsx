import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import BogTabs from "@/components/BogTabs/BogTabs";
import EventCard, { type Event } from "@/components/EventCard";
import EventService from "@/lib/services/EventService";
import { headers } from "next/headers";
import EditProfileButton from "@/components/EditProfileButton";
import HoursTab from "@/components/HoursTab";
import SaveBanner from "@/components/SaveBanner";
import db from "@/lib/db";
import { organizations } from "@/lib/schema";
import { inArray } from "drizzle-orm";

interface ProfilePageProps {
  searchParams: Promise<{ saved?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user! as typeof session.user & {
    phoneNumber?: string | null;
    displayName?: string | null;
    pronouns?: string | null;
    location?: string | null;
  };

  const { saved } = await searchParams;
  const bannerStatus: "success" | "error" | null =
    saved === "true" ? "success" : saved === "error" ? "error" : null;

  const allEvents = await EventService.findByUser(user.id);
  const now = new Date();

  const upcomingEvents = allEvents.filter(
    (e) => e.startTimestamp && new Date(e.startTimestamp) >= now,
  ) as Event[];

  const pastEvents = allEvents.filter(
    (e) => e.startTimestamp && new Date(e.startTimestamp) < now,
  ) as Event[];

  const orgIds = Array.from(new Set(allEvents.map((e) => e.organizationId)));
  const orgs =
    orgIds.length > 0
      ? await db
          .select({
            id: organizations.id,
            phoneNumber: organizations.phoneNumber,
          })
          .from(organizations)
          .where(inArray(organizations.id, orgIds))
      : [];

  const orgPhoneMap = Object.fromEntries(
    orgs.map((o) => [o.id, o.phoneNumber ?? "—"]),
  );

  const hoursEvents = allEvents
    .filter((e) => e.startTimestamp && e.duration)
    .map((e) => ({
      id: e.id,
      name: e.name,
      location: e.location,
      startTimestamp: new Date(e.startTimestamp!).toISOString(),
      duration: e.duration as string,
      eventContact: orgPhoneMap[e.organizationId] ?? "—",
    }));

  const displayedName = user.displayName || user.name;

  return (
    <div className="max-w-[1300px] mx-auto px-12 py-[60px]">
      <SaveBanner status={bannerStatus} />

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-10">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="w-[140px] h-[140px] rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-[140px] h-[140px] rounded-lg bg-[#D9D9D9] shrink-0 flex items-center justify-center">
              <span className="text-[#aaaaaa] text-[64px] font-light select-none leading-none">
                {user.name?.charAt(0).toUpperCase() ?? "?"}
              </span>
            </div>
          )}

          <div className="flex flex-col justify-between h-[140px]">
            <div>
              <div className="text-heading-3 font-medium text-black flex items-baseline gap-2">
                {displayedName}
                {user.pronouns && (
                  <span className="text-paragraph-2 font-normal text-black/50">
                    {user.pronouns}
                  </span>
                )}
              </div>
              {user.location && (
                <div className="text-paragraph-2 text-black/50">
                  {user.location}
                </div>
              )}
            </div>
            <div>
              {user.phoneNumber && (
                <div className="text-paragraph-2 mb-1.5">
                  <span className="font-bold">Phone : </span>
                  <span className="text-black/50">{user.phoneNumber}</span>
                </div>
              )}
              <div className="text-paragraph-2">
                <span className="font-bold">Email : </span>
                <span className="text-black/50">{user.email}</span>
              </div>
            </div>
          </div>
        </div>

        <EditProfileButton user={user} />
      </div>

      <BogTabs
        defaultValue="events"
        tabContents={{
          events: {
            label: "Events",
            content: (
              <>
                <div className="mt-[30px]">
                  <h2 className="text-heading-3 font-medium text-black mb-[30px]">
                    Upcoming events [{upcomingEvents.length}]
                  </h2>
                  <div className="flex gap-6 flex-wrap items-start">
                    {upcomingEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>

                <div className="mt-10">
                  <h2 className="text-heading-3 font-medium text-black mb-[30px]">
                    Past events [{pastEvents.length}]
                  </h2>
                  <div className="flex gap-6 flex-wrap items-start">
                    {pastEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              </>
            ),
          },
          hours: {
            label: "Hours",
            content: <HoursTab events={hoursEvents} />,
          },
        }}
      />
    </div>
  );
}
