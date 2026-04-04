import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getActiveOrganizationIdFromHeaders,
  redirectIfNotAdmin,
} from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationConfigKey } from "@/lib/schema";
import MembersTable from "@/components/MembersTable";

const DEFAULT_PAGE_SIZE = 20;

interface MembersPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const session = await redirectIfNotAdmin();
  const headerList = await headers();
  const organizationId = await getActiveOrganizationIdFromHeaders(headerList);

  if (!organizationId) {
    redirect("/");
  }

  const config = await OrganizationConfigService.getConfig(organizationId, [
    OrganizationConfigKey.MembersPageEnabled,
  ]);

  if (!config[OrganizationConfigKey.MembersPageEnabled]) {
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

  async function addMemberDirectly(orgId: string, email: string, name: string) {
    "use server";
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user) {
        return { error: "Unauthorized" };
      }

      if (session.session.activeOrganizationId !== orgId) {
        return { error: "Forbidden" };
      }

      const membership = await MembersService.findByUserAndOrganization(
        session.user.id,
        orgId,
      );

      if (!MembersService.isAdminOrOwner(membership?.role)) {
        return { error: "Forbidden: insufficient permissions" };
      }

      await MembersService.addMemberDirectly(email, name, orgId);
      return { success: true };
    } catch (error) {
      if (error instanceof Error) return { error: error.message };
      return { error: "Failed to add member directly" };
    }
  }

  return (
    <div className="max-w-[1300px] mx-auto px-12 py-[60px]">
      <MembersTable
        members={memberRows}
        total={total}
        page={page}
        pageSize={pageSize}
        organizationId={organizationId}
        currentUserId={session.user.id}
        onAddDirectly={addMemberDirectly}
      />
    </div>
  );
}
