import NotificationsWidget from "@/components/notifications/NotificationsWidget";
import RequestsPanel from "@/components/RequestsPanel";
import { OrganizationConfigKey } from "@/lib/schema";
import OrganizationConfigService from "@/lib/services/OrganizationConfigService";
import { headers } from "next/headers";
import { getActiveOrganizationIdFromHeaders } from "@/lib/authUtils";

export const metadata = {
  title: "Dashboard",
};

export default async function Page() {
  const headerList = await headers();
  const orgId = await getActiveOrganizationIdFromHeaders(headerList);
  const variant = orgId
    ? (
        await OrganizationConfigService.getConfig(orgId, [
          OrganizationConfigKey.NavbarVariant,
        ])
      )[OrganizationConfigKey.NavbarVariant]
    : "vertical-sidebar";
  const isTopNavbar =
    variant === "horizontal-left" ||
    variant === "horizontal-center" ||
    variant === "horizontal-right";

  return (
    <div className="flex h-full min-h-screen">
      {isTopNavbar && <RequestsPanel side="left" />}
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-heading-1 font-bold text-grey-text-strong">
            Dashboard
          </h1>
          <NotificationsWidget />
        </div>
        <div className="h-[644px] rounded-lg border-2 border-grey-stroke-weak bg-grey-fill-weaker" />
      </div>
      {!isTopNavbar && <RequestsPanel side="right" />}
    </div>
  );
}
