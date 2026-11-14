import { notFoundIfFeatureDisabled } from "@/core/auth/featureGuards";
import { headers } from "next/headers";
import { auth } from "@/core/auth/auth";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { MembersService } from "@/features/membership/services/MemberService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { OrganizationConfigKey } from "@/core/config/schema";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";
import { MemberTypeService } from "@/features/membership/server";
import MembersTable from "@/features/membership/components/MembersTable";

const DEFAULT_PAGE_SIZE = 20;

interface MembersPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; type?: string }>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const authSession = await redirectIfNotAdmin();
  const { organizationId } = authSession;

  const config = await OrganizationConfigService.getConfig(organizationId, [
    OrganizationConfigKey.MemberTypesEnabled,
  ]);
  const memberTypesEnabled = config[OrganizationConfigKey.MemberTypesEnabled];

  await notFoundIfFeatureDisabled(
    organizationId,
    OrganizationConfigKey.MembersPageEnabled,
  );

  const {
    page: pageParam,
    pageSize: pageSizeParam,
    type: typeParam,
  } = await searchParams;

  const memberTypeRows = memberTypesEnabled
    ? await MemberTypeService.list(organizationId)
    : [];
  const orgTypeKeys = new Set(memberTypeRows.map((row) => row.key));
  const parsedType = typeParam
    ? MemberTypeKeySchema.safeParse(typeParam)
    : undefined;
  const memberType =
    memberTypesEnabled &&
    parsedType?.success &&
    orgTypeKeys.has(parsedType.data)
      ? parsedType.data
      : undefined;

  const requestedPage = Math.max(1, parseInt(pageParam ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(pageSizeParam ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE,
    ),
  );
  const total = await MembersService.countByOrganization(
    organizationId,
    memberType,
  );
  // A type change or removal can empty the last page, so stay in range.
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(total / pageSize)),
  );
  const offset = (page - 1) * pageSize;

  const memberRows = await MembersService.listMembers(organizationId, {
    limit: pageSize,
    offset,
    memberType,
  });

  async function addMemberDirectly(orgId: string, email: string, name: string) {
    "use server";
    try {
      const session = await auth.api.getSession({
        headers: await headers(),
      });

      if (!session?.user) {
        return { error: "Unauthorized" };
      }

      const activeOrganizationId = session.session.activeOrganizationId;
      if (!activeOrganizationId || activeOrganizationId !== orgId) {
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
    <div className="max-w-8xl mx-auto px-12 py-16">
      <MembersTable
        members={memberRows}
        total={total}
        page={page}
        pageSize={pageSize}
        organizationId={organizationId}
        currentUserId={authSession.user.id}
        memberTypesEnabled={memberTypesEnabled}
        memberTypes={memberTypeRows}
        memberTypeFilter={memberType ?? null}
        onAddDirectly={addMemberDirectly}
      />
    </div>
  );
}
