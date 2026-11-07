import { redirectIfNotMember } from "@/core/auth/authUtils";
import { getDashboardAudience } from "@/features/membership/lib/audience";
import { MembersService } from "@/features/membership/services/MemberService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import DashboardGrid from "@/features/dashboard/components/DashboardGrid";
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";

export const metadata = {
  title: "Dashboard",
};

export default async function Page() {
  const session = await redirectIfNotMember();
  const { organizationId } = session;

  const [membership, memberTypesEnabled] = await Promise.all([
    MembersService.findByUserAndOrganization(session.user.id, organizationId),
    OrganizationConfigService.getMemberTypesEnabled(organizationId),
  ]);
  const audience = getDashboardAudience(membership, memberTypesEnabled);
  const layout = await OrganizationConfigService.getDashboardLayoutFor(
    organizationId,
    audience,
  );

  return (
    <div className="min-w-0 px-4 pb-12 pt-6 mobile:px-8 desktop:px-24 desktop:pb-18 desktop:pt-8">
      <DashboardHeader
        organizationId={organizationId}
        audience={audience}
        user={{ id: session.user.id, name: session.user.name }}
      />
      <DashboardGrid
        layout={layout}
        organizationId={organizationId}
        userId={session.user.id}
        audience={audience}
      />
    </div>
  );
}
