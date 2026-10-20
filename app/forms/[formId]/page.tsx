import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import BogBanner from "@/components/bog/BogBanner/BogBanner";
import DynamicForm from "@/components/forms/DynamicForm";
import FormFillClient from "@/components/forms/FormFillClient";
import FormMessage from "@/components/forms/FormMessage";
import FormPageLayout from "@/components/forms/FormPageLayout";
import LocalDateTime from "@/components/forms/LocalDateTime";
import { auth } from "@/lib/auth";
import { getSlugFromHost } from "@/lib/clientAuthUtils";
import { FormIdSchema } from "@/lib/forms/schema";
import { getFormAvailability } from "@/lib/forms/submission";
import { OrganizationConfigKey } from "@/lib/schema";
import { FormSubmissionService } from "@/lib/services/FormSubmissionService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

type FormPageProps = {
  params: Promise<{ formId: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export default async function FormPage({
  params,
  searchParams,
}: FormPageProps) {
  const { formId } = await params;
  const { preview } = await searchParams;
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
  const membership = session
    ? await MembersService.findByUserAndOrganization(
        session.user.id,
        organization.id,
      )
    : null;
  const pagePath = `/forms/${formId}${preview ? `?preview=${encodeURIComponent(preview)}` : ""}`;
  const loginPath = `/login?redirect=${encodeURIComponent(pagePath)}`;

  // Admins can preview drafts, so log in before deciding the form is missing.
  if (preview === "1" && !session) redirect(loginPath);
  const isPreview =
    preview === "1" && MembersService.isAdminOrOwner(membership?.role);

  const form = isPreview
    ? await FormSubmissionService.getDefinition(organization.id, formId)
    : await FormSubmissionService.getPublishedDefinition(
        organization.id,
        formId,
      );
  if (!form) notFound();

  if (!isPreview && form.settings.requireLogin) {
    if (!session) redirect(loginPath);
    if (!membership) redirect("/joinrequeststatus");
  }

  const availability = getFormAvailability(form);
  const alreadySubmitted =
    !isPreview &&
    availability === "open" &&
    session !== null &&
    membership !== null &&
    !form.settings.allowMultipleSubmissions &&
    (await FormSubmissionService.hasSubmitted(form.id, session.user.id));

  // Plain data for the client components.
  const definition = { formId: form.formId, components: form.components };

  let content;
  if (isPreview) {
    content = <DynamicForm definition={definition} preview />;
  } else if (availability === "not_yet_open" && form.settings.opensAt) {
    content = (
      <FormMessage title="This form isn't open yet">
        It opens <LocalDateTime iso={form.settings.opensAt} />.
      </FormMessage>
    );
  } else if (availability !== "open") {
    content = (
      <FormMessage title="This form is closed">
        It's no longer accepting responses.
      </FormMessage>
    );
  } else if (alreadySubmitted) {
    content = (
      <FormMessage title="You've already responded">
        Thanks! We have your response to this form.
      </FormMessage>
    );
  } else {
    content = <FormFillClient definition={definition} />;
  }

  return (
    <FormPageLayout
      organizationName={organization.name}
      logoUrl={config[OrganizationConfigKey.LogoUrl]}
    >
      {isPreview && (
        <BogBanner
          type="warning"
          variant="surface"
          content={<span>Preview – submissions are off</span>}
        />
      )}
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-page-text">{form.title}</h1>
        {form.description && (
          <p className="whitespace-pre-line text-paragraph-1 text-page-text">
            {form.description}
          </p>
        )}
      </header>
      {content}
    </FormPageLayout>
  );
}
