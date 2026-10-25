import { redirectIfNotMember } from "@/lib/authUtils";
import { getDashboardAudience } from "@/lib/dashboard/audience";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

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
