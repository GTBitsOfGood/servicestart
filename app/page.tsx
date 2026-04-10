import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { DEFAULT_MEMBER_LAYOUT } from "@/lib/dashboard/constants";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import { redirectIfNotMember } from "@/lib/authUtils";

export const metadata = {
  title: "Dashboard",
};

export default async function Page() {
  const session = await redirectIfNotMember();

  const organizationId = session.session.activeOrganizationId;
  let isAdmin = false;
  let layout = DEFAULT_MEMBER_LAYOUT;

  if (organizationId) {
    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );
    isAdmin = MembersService.isAdminOrOwner(membership?.role) ?? false;

    layout = isAdmin
      ? await OrganizationConfigService.getAdminDashboardLayout(organizationId)
      : await OrganizationConfigService.getDashboardLayout(organizationId);
  }

  return (
    <div className="px-24 pb-[72px] pt-8">
      <h1 className="mb-8 font-normal text-heading-1 text-grey-text-strong">
        {isAdmin ? "Admin Dashboard" : "Dashboard"}
      </h1>

      <DashboardGrid layout={layout} />
    </div>
  );
}
