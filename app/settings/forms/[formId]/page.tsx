import { notFoundIfFeatureDisabled } from "@/core/auth/featureGuards";
import { notFound } from "next/navigation";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { FormError } from "@/features/forms/lib/management";
import { FormIdSchema } from "@/features/forms/lib/schema";
import { OrganizationConfigKey } from "@/core/config/schema";
import { FormQuestionService } from "@/features/forms/services/FormQuestionService";
import FormBuilderClient from "@/features/forms/components/builder/FormBuilderClient";

export const metadata = { title: "Edit questions" };

export default async function FormBuilderPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { organizationId } = await redirectIfNotAdmin();
  await notFoundIfFeatureDisabled(
    organizationId,
    OrganizationConfigKey.FormsEnabled,
  );

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
