import { notFoundIfFeatureDisabled } from "@/core/auth/featureGuards";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { redirectIfNotAdmin } from "@/core/auth/authUtils";
import { FormError } from "@/features/forms/lib/management";
import { FormIdSchema } from "@/features/forms/lib/schema";
import { OrganizationConfigKey } from "@/core/config/schema";
import { FormService } from "@/features/forms/services/FormService";
import { FormReviewService } from "@/features/forms/services/FormReviewService";
import FormResponsesClient from "@/features/forms/components/FormResponsesClient";

export const metadata = { title: "Form responses" };

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { organizationId } = await redirectIfNotAdmin();
  const { formId } = await params;
  await notFoundIfFeatureDisabled(
    organizationId,
    OrganizationConfigKey.FormsEnabled,
  );
  if (!FormIdSchema.safeParse(formId).success) notFound();
  let form;
  try {
    form = await FormService.get(organizationId, formId);
  } catch (error) {
    if (error instanceof FormError && error.reason === "not-found") notFound();
    throw error;
  }
  // Resolve access and the form before streaming so inaccessible forms return 404.
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8">
          Loading responses…
        </p>
      }
    >
      <Responses
        organizationId={organizationId}
        formId={formId}
        title={form.title}
      />
    </Suspense>
  );
}

async function Responses({
  organizationId,
  formId,
  title,
}: {
  organizationId: string;
  formId: string;
  title: string;
}) {
  const data = await FormReviewService.listResponses(organizationId, formId, {
    limit: 25,
    offset: 0,
  });
  return (
    <FormResponsesClient
      key={`${organizationId}:${formId}`}
      formId={formId}
      title={title}
      initialData={{
        ...data,
        rows: data.rows.map((row) => ({
          ...row,
          submittedAt: row.submittedAt.toISOString(),
          updatedAt: row.updatedAt?.toISOString() ?? null,
        })),
      }}
    />
  );
}
