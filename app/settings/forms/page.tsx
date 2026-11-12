import { notFound } from "next/navigation";
import { Suspense } from "react";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { OrganizationConfigKey } from "@/core/config/schema";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { FormService } from "@/features/forms/services/FormService";
import { MemberTypeService } from "@/features/membership/server";
import FormsClient from "@/features/forms/components/FormsClient";

export const metadata = { title: "Forms" };

export default async function FormsPage() {
  const { organizationId } = await redirectIfNotAdmin();
  const config = await OrganizationConfigService.getConfig(organizationId, [
    OrganizationConfigKey.FormsEnabled,
    OrganizationConfigKey.MemberTypesEnabled,
  ]);
  if (!config[OrganizationConfigKey.FormsEnabled]) notFound();
  // Start streaming only after access checks, so disabled forms return HTTP 404.
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8">
          Loading forms…
        </p>
      }
    >
      <FormsList
        organizationId={organizationId}
        memberTypesEnabled={Boolean(
          config[OrganizationConfigKey.MemberTypesEnabled],
        )}
      />
    </Suspense>
  );
}

async function FormsList({
  organizationId,
  memberTypesEnabled,
}: {
  organizationId: string;
  memberTypesEnabled: boolean;
}) {
  const memberTypes = memberTypesEnabled
    ? await MemberTypeService.list(organizationId)
    : [];
  const forms = await FormService.list(organizationId);
  return (
    <FormsClient
      memberTypes={memberTypes}
      forms={forms.map((form) => ({
        ...form,
        createdAt: form.createdAt.toISOString(),
        updatedAt: form.updatedAt.toISOString(),
      }))}
    />
  );
}
