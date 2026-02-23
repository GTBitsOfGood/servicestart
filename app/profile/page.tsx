import { redirect } from "next/navigation";
import authClient from "@/lib/authClient";
import BogButton from "@/components/BogButton/BogButton";
import BogTabs from "@/components/BogTabs/BogTabs";
import EventCard, { type Event } from "@/components/EventCard";
import EventService from "@/lib/services/EventService";
import Link from "next/link";
import { headers } from "next/headers";

export default async function ProfilePage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  if (!session?.data?.user) {
    redirect("/login");
  }

  const user = session.data!.user!;
  const allEvents = await EventService.findByUser(user.id);
  const now = new Date();

  const upcomingEvents = allEvents.filter(
    (e) => e.startTimestamp && new Date(e.startTimestamp) >= now,
  ) as Event[];

  const pastEvents = allEvents.filter(
    (e) => !e.startTimestamp || new Date(e.startTimestamp) < now,
  ) as Event[];

  return (
    <div className="max-w-[1300px] mx-auto px-12 py-[60px]">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-6">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="w-[110px] h-[110px] rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-[110px] h-[110px] rounded-full bg-[#D9D9D9] shrink-0" />
          )}

          <div>
            <div className="text-heading-3 font-medium text-black mb-5">
              {user.name}
            </div>
            {(user as { phoneNumber?: string }).phoneNumber && (
              <div className="text-paragraph-2 mb-1.5">
                <span className="font-bold">Phone : </span>
                <span className="text-[#22070b80]">
                  {(user as { phoneNumber?: string }).phoneNumber}
                </span>
              </div>
            )}
            <div className="text-paragraph-2">
              <span className="font-bold">Email : </span>
              <span className="text-[#22070b80]">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/profile/edit">
            <BogButton
              variant="primary"
              size="responsive"
              className="bg-[#22070b]/50"
            >
              Edit Details
            </BogButton>
          </Link>
        </div>
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
            content: (
              <div className="text-paragraph-2 text-[#888]">
                Hours content will be here (tbd).
              </div>
            ),
          },
        }}
      />
    </div>
  );
}
