import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { notFoundIfFeatureDisabled } from "@/core/auth/featureGuards";
import { OrganizationConfigKey } from "@/core/config/schema";
import MemberTypesClient from "@/features/membership/components/MemberTypesClient";
import { MemberTypeService } from "@/features/membership/server";

export const metadata = { title: "Member types" };

export default async function MemberTypesPage() {
  const { organizationId } = await redirectIfNotAdmin();
  await notFoundIfFeatureDisabled(
    organizationId,
    OrganizationConfigKey.MemberTypesEnabled,
  );
  const memberTypes = await MemberTypeService.list(organizationId);
  return <MemberTypesClient initialTypes={memberTypes} />;
}
