import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import LocalDateTime from "@/components/forms/LocalDateTime";
import RequiredFormsPanel from "@/components/forms/RequiredFormsPanel";
import ReviewStatusDropdown from "@/components/forms/ReviewStatusDropdown";
import SubmissionSections from "@/components/forms/SubmissionSections";
import { redirectIfNotAdmin } from "@/lib/authUtils";
import { getRequiredFormStatus } from "@/lib/forms/review";
import { FormIdSchema, isImageAnswer } from "@/lib/forms/schema";
import {
  FormComponentType,
  FormStatus,
  OrganizationConfigKey,
} from "@/lib/schema";
import { FormProgressService } from "@/lib/services/FormProgressService";
import { FormSubmissionService } from "@/lib/services/FormSubmissionService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationConfigService } from "@/lib/services/OrganizationConfigService";

export const metadata = { title: "Response" };

type SubmissionPageProps = {
  params: Promise<{ formId: string; submissionId: string }>;
};

/** One submission to a form, for admins reviewing it. */
export default async function SubmissionPage({ params }: SubmissionPageProps) {
  const { organizationId } = await redirectIfNotAdmin();
  const { formId, submissionId } = await params;
  const config = await OrganizationConfigService.getConfig(organizationId, [
    OrganizationConfigKey.FormsEnabled,
    OrganizationConfigKey.MemberTypesEnabled,
  ]);
  if (
    !config[OrganizationConfigKey.FormsEnabled] ||
    !FormIdSchema.safeParse(formId).success ||
    !z.uuid().safeParse(submissionId).success
  )
    notFound();

  const detail = await FormSubmissionService.getSubmissionDetail(
    organizationId,
    submissionId,
  );
  if (!detail || detail.definition.formId !== formId) notFound();
  const { submission, submitter, definition, answers } = detail;

  const formPath = encodeURIComponent(definition.formId);
  const uploadsPath = `/api/forms/${formPath}/uploads`;
  // The first image answer, shown large instead of with the other answers.
  const [headshot] = definition.components.flatMap(({ id, type, label }) => {
    const answer = answers[id];
    return type === FormComponentType.Image && isImageAnswer(answer)
      ? [{ id, label, uploadId: answer.uploadId }]
      : [];
  });

  const membership =
    submitter &&
    (await MembersService.findByUserAndOrganization(
      submitter.id,
      organizationId,
    ));
  const memberType = config[OrganizationConfigKey.MemberTypesEnabled]
    ? (membership?.memberType ?? null)
    : null;
  const requiredForms =
    submitter &&
    (
      await FormProgressService.listForMember(
        organizationId,
        submitter.id,
        memberType,
      )
    )
      .filter(({ required, form }) => required && form.id !== definition.id)
      .map((progress) => {
        const status = getRequiredFormStatus(progress);
        return {
          formId: progress.form.formId,
          title: progress.form.title,
          dueAt: progress.form.dueAt,
          status,
          submissionId: progress.submission?.id ?? null,
          canRequest:
            Boolean(membership) &&
            status !== "completed" &&
            progress.form.status === FormStatus.Published,
        };
      });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 text-grey-text-strong tablet:px-8">
      <Link
        href={`/settings/forms/${formPath}/responses`}
        className="inline-flex items-center gap-2 self-start text-paragraph-2 text-grey-text-weak hover:text-grey-text-strong"
      >
        <BogIcon name="arrow-left" size={18} />
        Back to responses
      </Link>

      <header className="flex flex-col gap-6 tablet:flex-row tablet:items-start tablet:justify-between">
        <div className="flex flex-col gap-6 tablet:flex-row tablet:items-center">
          {headshot && (
            <img
              src={`${uploadsPath}/${encodeURIComponent(headshot.uploadId)}`}
              alt={headshot.label}
              className="size-40 shrink-0 rounded-lg bg-grey-fill-weak object-cover desktop:size-48"
            />
          )}
          <div className="flex flex-col gap-2">
            <p className="text-paragraph-2 font-semibold text-brand-text">
              {definition.title}
            </p>
            <h1 className="font-display text-heading-2 text-page-text">
              {submitter?.name ?? "Guest"}
            </h1>
            {submitter && (
              <a
                href={`mailto:${submitter.email}`}
                className="self-start text-paragraph-1 text-grey-text-weak hover:text-grey-text-strong"
              >
                {submitter.email}
              </a>
            )}
            <dl className="flex flex-col gap-1 text-paragraph-2 text-grey-text-weak">
              <div className="flex gap-1">
                <dt>Submitted</dt>
                <dd>
                  <LocalDateTime iso={submission.submittedAt.toISOString()} />
                </dd>
              </div>
              {submission.updatedAt && (
                <div className="flex gap-1">
                  <dt>Last edited</dt>
                  <dd>
                    <LocalDateTime iso={submission.updatedAt.toISOString()} />
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        <ReviewStatusDropdown
          submissionId={submission.id}
          initialStatus={submission.reviewStatus}
        />
      </header>

      <div className="grid grid-cols-1 items-start gap-8 desktop:grid-cols-[minmax(0,1fr)_20rem]">
        <SubmissionSections
          definition={{
            formId: definition.formId,
            components: definition.components.filter(
              ({ id }) => id !== headshot?.id,
            ),
          }}
          answers={answers}
          uploadsPath={uploadsPath}
        />
        {submitter && requiredForms && (
          <RequiredFormsPanel
            member={{ id: submitter.id, name: submitter.name }}
            forms={requiredForms}
          />
        )}
      </div>
    </main>
  );
}
