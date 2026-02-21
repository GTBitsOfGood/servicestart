"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import authClient from "@/lib/authClient";
import BogButton from "@/components/BogButton/BogButton";
import BogTabs from "@/components/BogTabs/BogTabs";

type Event = {
  id: string;
  name: string;
  location: string;
  description?: string | null;
  startTimestamp: string | null;
  coverImageUrl?: string | null;
  organizationId: string;
};

function EventCard({ event }: { event: Event }) {
  const router = useRouter();

  const date = event.startTimestamp
    ? new Date(event.startTimestamp).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
      })
    : "TBD";
  const time = event.startTimestamp
    ? new Date(event.startTimestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      style={{
        width: 230,
        minWidth: 230,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 145,
          backgroundColor: "#D9D9D9",
          borderRadius: 12,
          marginBottom: 12,
          backgroundImage: event.coverImageUrl
            ? `url(${event.coverImageUrl})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          className="text-paragraph-2"
          style={{ fontWeight: 700, color: "#000", fontSize: 18 }}
        >
          {event.name}
        </div>
        <div
          className="text-small"
          style={{ fontWeight: 600, color: "#000", fontSize: 15 }}
        >
          {date}
          {time ? ` • ${time}` : ""}
        </div>
        <div className="text-small" style={{ color: "#000", fontSize: 15 }}>
          {event.organizationId}
        </div>
        <div className="text-small" style={{ color: "#000", fontSize: 14 }}>
          {event.location}
        </div>
        <button
          onClick={() => router.push(`/event/${event.id}`)}
          className="text-small"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#rgba(34, 7, 11, 0.50)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            width: "fit-content",
            fontSize: 14,
          }}
        >
          View details <span style={{ fontSize: 14 }}>{">"}</span>
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const { data: session, isPending } = authClient.useSession();
  const [mounted, setMounted] = useState(false); //need this for bogtabs

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
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
      });
  }, [session]);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace("/login");
    }
  }, [isPending, session, router]);
  useEffect(() => setMounted(true), []);
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
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "60px 48px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              style={{
                width: 110,
                height: 110,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: "50%",
                backgroundColor: "#D9D9D9",
                flexShrink: 0,
              }}
            />
          )}

          <div>
            <div
              className="text-heading-3"
              style={{ fontWeight: 500, color: "#000", marginBottom: 20 }}
            >
              {user.name}
            </div>
            {user.phoneNumber && (
              <div className="text-paragraph-2" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>Phone : </span>
                <span style={{ color: "rgba(34, 7, 11, 0.50)" }}>
                  {user.phoneNumber}
                </span>
              </div>
            )}
            <div className="text-paragraph-2">
              <span style={{ fontWeight: 700 }}>Email : </span>
              <span style={{ color: "rgba(34, 7, 11, 0.50)" }}>
                {user.email}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
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
                <div style={{ marginTop: 30, marginBottom: 0 }}>
                  <h2
                    className="text-heading-3"
                    style={{ fontWeight: 500, color: "#000", marginBottom: 30 }}
                  >
                    Upcoming events [{upcomingEvents.length}]
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    {upcomingEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 40 }}>
                  <h2
                    className="text-heading-3"
                    style={{
                      fontWeight: 500,
                      color: "#000",
                      marginBottom: 30,
                    }}
                  >
                    Past events [{pastEvents.length}]
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
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
              <div className="text-paragraph-2" style={{ color: "#888" }}>
                Hours content will be here (tbd).
              </div>
            ),
          },
        }}
      />
    </div>
  );
}
