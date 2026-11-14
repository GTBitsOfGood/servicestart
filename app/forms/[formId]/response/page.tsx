import { notFoundIfFeatureDisabled } from "@/core/auth/featureGuards";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import FormPageLayout from "@/features/forms/components/FormPageLayout";
import FormResponseView from "@/features/forms/components/FormResponseView";
import LocalDateTime from "@/features/forms/components/LocalDateTime";
import { auth } from "@/core/auth/auth";
import { resolveOrganization } from "@/core/tenant/resolveOrganization";
import { FormIdSchema } from "@/features/forms/lib/schema";
import {
  canEditSubmission,
  getFormAvailability,
} from "@/features/forms/lib/submission";
import { OrganizationConfigKey } from "@/core/config/schema";
import { FormSubmissionService } from "@/features/forms/services/FormSubmissionService";
import { MembersService } from "@/features/membership/services/MemberService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";

export const metadata = { title: "Your response" };

type ResponsePageProps = { params: Promise<{ formId: string }> };

/**
 * A member's own latest response to a form, read-only, with a link to edit it
 * while it's still editable (the form is open and the response is pending).
 */
export default async function ResponsePage({ params }: ResponsePageProps) {
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
    redirect(
      `/login?redirect=${encodeURIComponent(`/forms/${formId}/response`)}`,
    );
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
  if (!response) notFound();
  const { definition, submission, answers } = response;
  const canEdit = canEditSubmission({
    availability: getFormAvailability(definition),
    reviewStatus: submission.reviewStatus,
  });

  return (
    <FormPageLayout
      organizationName={organization.name}
      logoUrl={config[OrganizationConfigKey.LogoUrl]}
      showHomeLink
    >
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-page-text">{definition.title}</h1>
        <p className="text-paragraph-1 text-grey-text-weak">
          Your response, submitted{" "}
          <LocalDateTime iso={submission.submittedAt.toISOString()} />
          {submission.updatedAt && (
            <>
              {" "}
              and last edited{" "}
              <LocalDateTime iso={submission.updatedAt.toISOString()} />
            </>
          )}
          .
        </p>
        {canEdit && (
          <Link
            href={`/forms/${encodeURIComponent(definition.formId)}/edit`}
            className="theme-control self-start rounded border border-brand-stroke-strong px-4 py-2 text-paragraph-1 font-semibold text-brand-text hover:bg-brand-fill"
          >
            Edit response
          </Link>
        )}
      </header>
      <FormResponseView
        definition={{
          formId: definition.formId,
          components: definition.components,
        }}
        answers={answers}
        uploadsPath={`/api/forms/${encodeURIComponent(definition.formId)}/my-uploads`}
      />
    </FormPageLayout>
  );
}
