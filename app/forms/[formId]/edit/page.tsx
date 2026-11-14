import { notFoundIfFeatureDisabled } from "@/core/auth/featureGuards";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import FormEditView from "@/features/forms/components/FormEditView";
import FormPageLayout from "@/features/forms/components/FormPageLayout";
import { auth } from "@/core/auth/auth";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import { FormIdSchema } from "@/features/forms/lib/schema";
import { OrganizationConfigKey } from "@/core/config/schema";
import { FormSubmissionService } from "@/features/forms/services/FormSubmissionService";
import { MembersService } from "@/features/membership/services/MemberService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";

export const metadata = { title: "Edit your response" };

type EditPageProps = { params: Promise<{ formId: string }> };

/** A member's own response to a form, open for changes while the form is. */
export default async function EditResponsePage({ params }: EditPageProps) {
  const { formId } = await params;
  const requestHeaders = await headers();

  const session = await auth.api.getSession({ headers: requestHeaders });
  const organization = await resolveOrganization(requestHeaders, session);
  if (!organization || !FormIdSchema.safeParse(formId).success) notFound();
  const config = await OrganizationConfigService.getConfig(organization.id, [
    OrganizationConfigKey.LogoUrl,
  ]);
  await notFoundIfFeatureDisabled(
    organization.id,
    OrganizationConfigKey.FormsEnabled,
  );

  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(`/forms/${formId}/edit`)}`);
  }
  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organization.id,
  );
  if (!membership) redirect("/joinrequeststatus");

  const response = await FormSubmissionService.getMemberSubmission(
    organization.id,
    formId,
    session.user.id,
  );
  if (!response) redirect(`/forms/${encodeURIComponent(formId)}`);
  const { definition, submission, answers } = response;

  return (
    <FormPageLayout
      organizationName={organization.name}
      logoUrl={config[OrganizationConfigKey.LogoUrl]}
      showHomeLink
    >
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-page-text">{definition.title}</h1>
        <p className="text-paragraph-1 text-grey-text-weak">
          Editing your response.
        </p>
      </header>
      <FormEditView
        definition={definition}
        answers={answers}
        reviewStatus={submission.reviewStatus}
      />
    </FormPageLayout>
  );
}
