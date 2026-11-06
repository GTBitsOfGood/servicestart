import { notFound } from "next/navigation";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { FormError } from "@/features/forms/lib/management";
import { FormIdSchema } from "@/features/forms/lib/schema";
import { OrganizationConfigKey } from "@/core/config/schema";
import { FormQuestionService } from "@/features/forms/services/FormQuestionService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import FormBuilderClient from "@/features/forms/components/builder/FormBuilderClient";

export const metadata = { title: "Edit questions" };

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { organizationId } = await redirectIfNotAdmin();
  const config = await OrganizationConfigService.getConfig(organizationId, [
    OrganizationConfigKey.FormsEnabled,
  ]);
  if (!config[OrganizationConfigKey.FormsEnabled]) notFound();

  const formId = FormIdSchema.safeParse((await params).formId);
  if (!formId.success) notFound();
  let form;
  try {
    form = await FormQuestionService.get(organizationId, formId.data);
  } catch (error) {
    if (error instanceof FormError && error.reason === "not-found") notFound();
    throw error;
  }

  return <FormBuilderClient {...form} />;
}
