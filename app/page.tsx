import NotificationsWidget from "@/components/notifications/NotificationsWidget";
import RequestsPanel from "@/components/RequestsPanel";
import { OrganizationConfigKey } from "@/lib/schema";
import { headers } from "next/headers";
import { getActiveOrganizationIdFromHeaders } from "@/lib/authUtils";
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
  
    const variant = organizationId
    ? (
        await OrganizationConfigService.getConfig(organizationId, [
          OrganizationConfigKey.NavbarVariant,
        ])
      )[OrganizationConfigKey.NavbarVariant]
    : "vertical-sidebar";
  const isTopNavbar =
    variant === "horizontal-left" ||
    variant === "horizontal-center" ||
    variant === "horizontal-right";

  return (
    <div className="px-24 pb-[72px] pt-8">
      <h1 className="mb-8 font-normal text-heading-1 text-grey-text-strong">
        {isAdmin ? "Admin Dashboard" : "Dashboard"}
      </h1>

      <DashboardGrid layout={layout} />
    </div>
  );
}
