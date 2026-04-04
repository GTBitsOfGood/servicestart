import { headers } from "next/headers";
import { redirect } from "next/navigation";
import EventsPageClient from "./events-page";
import { auth } from "@/lib/auth";
import EventService from "@/lib/services/EventService";
import { MembersService } from "@/lib/services/MemberService";

const EVENTS_PAGE_LIMIT = 500;

export default async function EventsPage({
  searchParams,
}: PageProps<"/events">) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    redirect("/");
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );
  if (!membership) {
    redirect("/");
  }
  const search = await searchParams;
  const query = search?.query ?? undefined;
  const filter = search?.filter ?? undefined;

  const isAdmin = MembersService.isAdminOrOwner(membership.role);

  const rows = await EventService.listByOrganization(
    organizationId,
    {
      limit: EVENTS_PAGE_LIMIT,
      offset: 0,
    },
    {
      query: Array.isArray(query) ? query![0] : query,
      filter: Array.isArray(filter) ? filter![0] : filter,
    },
  );

  const serialized = rows.map((row) => ({
    ...row,
    startTimestamp:
      row.startTimestamp !== null
        ? new Date(row.startTimestamp).toISOString()
        : null,
    publishedAt:
      row.publishedAt !== null ? new Date(row.publishedAt).toISOString() : null,
  }));

  return (
    <EventsPageClient
      events={serialized}
      isAdmin={isAdmin}
      canCreateEvents={isAdmin}
    />
  );
}
