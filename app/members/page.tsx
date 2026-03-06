import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationConfigKey } from "@/lib/schema";
import MembersTable from "@/components/MembersTable";

const DEFAULT_PAGE_SIZE = 20;

interface MembersPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
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

  if (!MembersService.isAdminOrOwner(membership?.role)) {
    redirect("/");
  }

  const config = await OrganizationConfigService.getConfig(organizationId, [
    OrganizationConfigKey.MembersPageEnabled,
  ]);

  if (config[OrganizationConfigKey.MembersPageEnabled] === "false") {
    redirect("/");
  }

  const { page: pageParam, pageSize: pageSizeParam } = await searchParams;

  const page = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(pageSizeParam ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    ),
  );
  const offset = (page - 1) * pageSize;

  const [memberRows, total] = await Promise.all([
    MembersService.listMembers(organizationId, { limit: pageSize, offset }),
    MembersService.countByOrganization(organizationId),
  ]);

  return (
    <div className="max-w-[1300px] mx-auto px-12 py-[60px]">
      <MembersTable
        members={memberRows}
        total={total}
        page={page}
        pageSize={pageSize}
        organizationId={organizationId}
        currentUserId={session.user.id}
      />
    </div>
  );
}
