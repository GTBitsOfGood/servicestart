import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getActiveOrganizationIdFromHeaders,
  requireSessionOrRedirect,
} from "@/lib/authUtils";
import { MembersService } from "@/lib/services/MemberService";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { JoinRequestStatus } from "@/lib/schema";
import { DEFAULT_MEMBER_LAYOUT } from "@/lib/dashboard/constants";
import DashboardGrid from "@/components/dashboard/DashboardGrid";

export const metadata = {
  title: "Dashboard",
};

export default async function Page() {
  const session = await redirectIfNotMember();
  const headerList = await headers();
  const session = await requireSessionOrRedirect(headerList);

  const resolvedOrganizationId =
    await getActiveOrganizationIdFromHeaders(headerList);
  if (resolvedOrganizationId) {
    const membership = await MembersService.findByUserAndOrganization(
      session.user.id,
      resolvedOrganizationId,
    );
    if (!membership) {
      const joinRequest = await JoinRequestsService.findByUserAndOrganization(
        session.user.id,
        resolvedOrganizationId,
      );
      if (joinRequest?.status === JoinRequestStatus.Pending) {
        redirect("/joinrequeststatus");
      }
    }
  }

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
