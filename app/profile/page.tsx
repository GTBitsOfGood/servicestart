"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import BogButton from "@/components/BogButton/BogButton";
import BogTabs from "@/components/BogTabs/BogTabs";
import EventCard, { type Event } from "@/components/EventCard";
import client from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const { data: session, isPending } = authClient.useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    async function getEvents() {
      const res = await client.events.$get({ query: {} });
      if (!res.ok) {
        const error = (await res.json()) as { error: string };
        console.error(error.error);
        return;
      }
      const data = await res.json();
      const events: Event[] = data.data ?? [];
      const now = new Date();
      setUpcomingEvents(
        events.filter(
          (e) => e.startTimestamp && new Date(e.startTimestamp) >= now,
        ),
      );
      setPastEvents(
        events.filter(
          (e) => !e.startTimestamp || new Date(e.startTimestamp) < now,
        ),
      );
    }
    getEvents();
  }, [session]);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (isPending || !session?.user) return null;
  if (!mounted) return null;

  const user = session.user as {
    name: string;
    email: string;
    image?: string;
    phoneNumber?: string;
  };

  const handleEdit = () => router.push("/profile/edit");

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
            {user.phoneNumber && (
              <div className="text-paragraph-2 mb-1.5">
                <span className="font-bold">Phone : </span>
                <span className="text-[rgba(34,7,11,0.50)]">
                  {user.phoneNumber}
                </span>
              </div>
            )}
            <div className="text-paragraph-2">
              <span className="font-bold">Email : </span>
              <span className="text-[rgba(34,7,11,0.50)]">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <BogButton
            variant="primary"
            size="responsive"
            onClick={handleEdit}
            style={{ background: "rgba(34, 7, 11, 0.50)" }}
          >
            Edit Details
          </BogButton>
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
