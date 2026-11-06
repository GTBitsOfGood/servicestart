import DashboardContentSettings from "@/features/dashboard/components/DashboardContentSettings";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";

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

  return (
    <DashboardContentSettings
      initialHeader={header}
      initialFooter={footer}
      memberTypesEnabled={Boolean(
        config[OrganizationConfigKey.MemberTypesEnabled],
      )}
    />
  );
}
