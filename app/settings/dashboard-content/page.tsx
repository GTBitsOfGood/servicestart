import DashboardContentSettings from "@/components/dashboard/DashboardContentSettings";
import { redirectIfNotAdmin } from "@/lib/authUtils";
import { OrganizationConfigKey } from "@/lib/schema";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

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
