import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import FormPageLayout from "@/components/forms/FormPageLayout";
import FormResponseView from "@/components/forms/FormResponseView";
import LocalDateTime from "@/components/forms/LocalDateTime";
import { auth } from "@/lib/auth";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { FormIdSchema } from "@/lib/forms/schema";
import { OrganizationConfigKey } from "@/lib/schema";
import { FormSubmissionService } from "@/lib/services/FormSubmissionService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

export const metadata = { title: "Your response" };

type ResponsePageProps = { params: Promise<{ formId: string }> };

/** A member's own latest response to a form, read-only. */
export default async function ResponsePage({ params }: ResponsePageProps) {
  const { formId } = await params;
  const requestHeaders = await headers();

  const organization = await OrganizationsService.findBySlug(
    getSlugFromHost(requestHeaders.get("host") ?? undefined),
  );
  if (!organization || !FormIdSchema.safeParse(formId).success) notFound();
  const config = await OrganizationConfigService.getConfig(organization.id, [
    OrganizationConfigKey.FormsEnabled,
    OrganizationConfigKey.LogoUrl,
  ]);
  if (!config[OrganizationConfigKey.FormsEnabled]) notFound();

  const session = await auth.api.getSession({ headers: requestHeaders });
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
