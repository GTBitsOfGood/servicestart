import { notFound } from "next/navigation";
import { redirectIfNotAdmin } from "@/lib/authUtils";
import { FormError } from "@/lib/forms/management";
import { FormIdSchema } from "@/lib/forms/schema";
import { OrganizationConfigKey } from "@/lib/schema";
import { FormQuestionService } from "@/lib/services/FormQuestionService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import FormBuilderClient from "@/components/forms/builder/FormBuilderClient";

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
