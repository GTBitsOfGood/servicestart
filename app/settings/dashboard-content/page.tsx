import DashboardContentSettings from "@/features/dashboard/components/DashboardContentSettings";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { MemberTypeService } from "@/features/membership/server";

export const metadata = { title: "Dashboard Content" };

export default async function DashboardContentSettingsPage() {
  const { organizationId } = await redirectIfNotAdmin();

  const [header, footer, config] = await Promise.all([
    OrganizationConfigService.getDashboardHeader(organizationId),
    OrganizationConfigService.getOrganizationFooter(organizationId),
    OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.MemberTypesEnabled,
    ]),
  ]);
  const memberTypesEnabled = config[OrganizationConfigKey.MemberTypesEnabled];
  const memberTypes = memberTypesEnabled
    ? await MemberTypeService.list(organizationId)
    : [];

  return (
    <DashboardContentSettings
      initialHeader={header}
      initialFooter={footer}
      memberTypesEnabled={memberTypesEnabled}
      memberTypes={memberTypes}
    />
  );
}
