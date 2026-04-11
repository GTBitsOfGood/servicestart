import { headers } from "next/headers";
import { redirect } from "next/navigation";
import EventsPageClient from "@/components/events/EventsPageClient";
import { auth } from "@/lib/auth";
import EventService from "@/lib/services/EventService";
import { MembersService } from "@/lib/services/MemberService";

const EVENTS_PAGE_LIMIT = 500;

interface EventsPageProps {
  searchParams: Promise<{
    filter?: string | string[];
    query?: string | string[];
  }>;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
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

  const isAdmin = MembersService.isAdminOrOwner(membership.role);
  const search = await searchParams;
  const query = Array.isArray(search?.query) ? search.query[0] : search?.query;
  const filterParam = Array.isArray(search?.filter)
    ? search.filter[0]
    : search?.filter;
  const filter = !isAdmin && filterParam === "drafts" ? undefined : filterParam;

  const rows = await EventService.listByOrganization(
    organizationId,
    {
      limit: EVENTS_PAGE_LIMIT,
      offset: 0,
    },
    {
      published: isAdmin ? undefined : true,
      query,
      filter,
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
