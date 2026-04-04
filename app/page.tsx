import NotificationsWidget from "@/components/notifications/NotificationsWidget";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { DEFAULT_MEMBER_LAYOUT } from "@/lib/dashboard/constants";
import DashboardGrid from "@/components/dashboard/DashboardGrid";

export const metadata = {
  title: "Dashboard",
};

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const organizationId = session?.session.activeOrganizationId;
  let isAdmin = false;
  let layout = DEFAULT_MEMBER_LAYOUT;

  if (session?.user && organizationId) {
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
