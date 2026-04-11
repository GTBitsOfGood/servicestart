import NotificationsWidget from "@/components/notifications/NotificationsWidget";
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
    <div className="flex h-full min-h-screen">
      <div className="flex-1 px-24 pb-[72px] pt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-heading-1 font-bold text-grey-text-strong">
            {isAdmin ? "Admin Dashboard" : "Dashboard"}
          </h1>
          <NotificationsWidget />
        </div>
        <DashboardGrid layout={layout} />
      </div>
    </div>
  );
}
