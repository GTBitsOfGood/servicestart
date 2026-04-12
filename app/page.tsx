import { redirect } from "next/navigation";
import { redirectIfNotMember } from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { JoinRequestStatus } from "@/lib/schema";
import DashboardGrid from "@/components/dashboard/DashboardGrid";

export const metadata = {
  title: "Dashboard",
};

export default async function Page() {
  const session = await redirectIfNotMember();
  const { organizationId } = session;

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );
  if (!membership) {
    const joinRequest = await JoinRequestsService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    );
    if (joinRequest?.status === JoinRequestStatus.Pending) {
      redirect("/joinrequeststatus");
    }
  }

  const isAdmin = MembersService.isAdminOrOwner(membership?.role) ?? false;
  const layout = isAdmin
    ? await OrganizationConfigService.getAdminDashboardLayout(organizationId)
    : await OrganizationConfigService.getDashboardLayout(organizationId);

  return (
    <div className="min-w-0 px-24 pb-[72px] pt-8">
      <h1 className="mb-8 font-normal text-heading-1 text-grey-text-strong">
        {isAdmin ? "Admin Dashboard" : "Dashboard"}
      </h1>

      <DashboardGrid layout={layout} />
    </div>
  );
}
