import Link from "next/link";
import { CheckIcon } from "@phosphor-icons/react/ssr";
import LocalDateTime from "@/features/forms/components/LocalDateTime";
import ReviewStatusChip from "@/features/forms/widgets/ReviewStatusChip";
import {
  getApplicationStatusView,
  getFirstName,
  NO_APPLICATION_MESSAGE,
  type ApplicationStatusView,
  type NextStep,
  type TimelineStep,
} from "@/features/forms/lib/applicationStatus";
import { memberTypeFromAudience } from "@/features/membership";
import { ApplicationStatusWidgetConfigSchema } from "@/features/dashboard";
import type { WidgetProps } from "@/features/dashboard";
import { OrganizationConfigKey } from "@/core/config/schema";
import { SubmissionReviewStatus } from "@/features/forms/schema";
import { FormProgressService } from "@/features/forms/services/FormProgressService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { UserService } from "@/features/membership";
import { cn } from "@/core/utils/utils";

const STEP_STATE_TEXT: Record<TimelineStep["state"], string> = {
  complete: "complete",
  current: "current",
  upcoming: "not started",
};

function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <section
      aria-labelledby="application-status-timeline"
      className="flex flex-col gap-6"
    >
      <h4
        id="application-status-timeline"
        className="text-paragraph-1 font-semibold text-app-strong-text"
      >
        Application timeline
      </h4>
      <ol className="grid grid-cols-3">
        {steps.map((step, index) => {
          const next = steps[index + 1];
          // The line to the next step fills up to the current step, and
          // halfway when this one is the last complete step.
          const fill = !next
            ? null
            : next.state !== "upcoming"
              ? "w-full"
              : step.state === "complete"
                ? "w-1/2"
                : "w-0";
          return (
            <li key={index} className="flex min-w-0 flex-col gap-3">
              <div className="flex items-center">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    step.state === "complete" &&
                      (step.neutral
                        ? "bg-grey-icon-weak text-solid-bg-base"
                        : "bg-brand-text text-brand-foreground"),
                    step.state === "current" && "border-2 border-brand-text",
                    step.state === "upcoming" &&
                      "border-2 border-grey-stroke-weak",
                  )}
                >
                  {step.state === "complete" && (
                    <CheckIcon size={12} weight="bold" />
                  )}
                </span>
                {fill && (
                  <span
                    aria-hidden
                    className="h-0.5 flex-1 bg-grey-stroke-weak"
                  >
                    <span
                      className={cn(
                        "block h-full",
                        fill,
                        next?.neutral ? "bg-grey-icon-weak" : "bg-brand-text",
                      )}
                    />
                  </span>
                )}
              </div>
              <div className="pr-3">
                <p className="text-paragraph-2 font-semibold break-words text-app-strong-text">
                  {step.label}
                  <span className="sr-only">
                    , {STEP_STATE_TEXT[step.state]}
                  </span>
                </p>
                {step.description && (
                  <p className="mt-1 text-paragraph-2 break-words text-grey-text-weak">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NextSteps({ items }: { items: NextStep[] }) {
  const done = items.filter((item) => item.done).length;
  const allDone = done === items.length;
  return (
    <section
      aria-labelledby="application-status-next-steps"
      className="flex flex-col gap-4 border-t border-grey-stroke-weak p-8 @6xl:w-2/5 @6xl:shrink-0 @6xl:border-t-0 @6xl:border-l"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4
          id="application-status-next-steps"
          className="text-paragraph-1 font-semibold text-app-strong-text"
        >
          Your next steps
        </h4>
        <p className="text-paragraph-2 text-grey-text-weak">
          {done} of {items.length} completed
        </p>
      </div>
      <p className="text-paragraph-2 text-grey-text-weak">
        To proceed to our next stage, our team needs you to complete the
        following items:
      </p>
      {items.length > 0 && (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li
              key={item.formId}
              className={cn(
                "flex gap-3 rounded-xl border border-grey-stroke-weak p-4",
                item.done && "opacity-50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1 flex size-6 shrink-0 items-center justify-center rounded",
                  item.done
                    ? "bg-brand-text text-brand-foreground"
                    : "border border-grey-stroke-strong",
                )}
              >
                {item.done && <CheckIcon size={10} weight="bold" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-paragraph-2 font-semibold text-app-strong-text">
                  {item.title}
                  {item.done && <span className="sr-only"> (completed)</span>}
                </p>
                {!item.done && item.dueAt && (
                  <p className="text-paragraph-2 text-grey-text-weak">
                    Complete this form by <LocalDateTime iso={item.dueAt} />
                  </p>
                )}
                {!item.done && (
                  <Link
                    href={`/forms/${encodeURIComponent(item.formId)}`}
                    className="theme-control rounded border border-brand-stroke-strong px-3 py-2 text-center text-paragraph-2 font-semibold text-brand-text hover:bg-brand-fill"
                  >
                    Open form
                    <span className="sr-only">: {item.title}</span>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {allDone && (
        <p className="py-6 text-center text-paragraph-2 text-grey-text-weak">
          All caught up!
        </p>
      )}
    </section>
  );
}

function Description({
  view,
}: {
  view: Extract<ApplicationStatusView, { kind: "application" }>;
}) {
  switch (view.status) {
    case SubmissionReviewStatus.Pending:
    case SubmissionReviewStatus.UnderReview:
      return (
        <p className="text-paragraph-1 text-grey-text-weak">
          Your application is currently being reviewed by our team.{" "}
          {view.nextSteps?.some((item) => !item.done)
            ? "Please complete any required documents to move forward in the process."
            : "Check back again later to review your status."}
        </p>
      );
    case SubmissionReviewStatus.Rejected:
      return (
        <p className="text-paragraph-1 text-grey-text-weak">
          Thank you for applying. After careful review, we aren&apos;t able to
          offer you a spot this time. We appreciate your interest and hope
          you&apos;ll apply again.
        </p>
      );
    case SubmissionReviewStatus.Accepted:
      return null;
    case null:
      return (
        <div className="flex flex-col items-start gap-4">
          {view.availability === "not_yet_open" ? (
            view.opensAt && (
              <p className="text-paragraph-1 text-grey-text-weak">
                Opens <LocalDateTime iso={view.opensAt} />
              </p>
            )
          ) : (
            <>
              {view.dueAt && (
                <p className="text-paragraph-1 text-grey-text-weak">
                  Due <LocalDateTime iso={view.dueAt} />
                </p>
              )}
              <Link
                href={`/forms/${encodeURIComponent(view.formId)}`}
                className="theme-control rounded bg-brand-text px-4 py-2 text-paragraph-2 font-semibold text-brand-foreground hover:opacity-90"
              >
                Start application
              </Link>
            </>
          )}
        </div>
      );
  }
}

export function ApplicationStatusWidgetView({
  view,
  firstName = null,
}: {
  view: ApplicationStatusView;
  firstName?: string | null;
}) {
  if (view.kind === "empty") {
    return (
      <div className="flex h-full flex-col rounded-xl bg-solid-bg-base p-8">
        <h3 className="text-heading-3 font-semibold text-app-strong-text">
          Application Status
        </h3>
        <p className="mt-4 flex flex-1 items-center justify-center text-center text-paragraph-1 text-grey-text-weak">
          {view.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto">
      {view.status === SubmissionReviewStatus.Accepted && (
        <div
          role="status"
          className="rounded-xl border border-status-green-stroke-weak bg-status-green-fill p-8 text-status-green-text"
        >
          <p className="text-heading-3 font-semibold">
            {firstName ? `Congratulations, ${firstName}!` : "Congratulations!"}
          </p>
          <p className="mt-2 text-paragraph-2">
            You&apos;ve been selected to join us. We&apos;re so excited to have
            you on the team!
          </p>
        </div>
      )}
      <div className="@container shrink-0 rounded-xl bg-solid-bg-base">
        <div className="flex flex-col @6xl:flex-row">
          <section
            aria-labelledby="application-status-title"
            className="flex min-w-0 flex-1 flex-col gap-8 p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <h3
                  id="application-status-title"
                  className="text-heading-3 font-semibold break-words text-app-strong-text"
                >
                  {view.title}
                </h3>
                {view.status && <ReviewStatusChip status={view.status} />}
              </div>
              {view.status && (
                <Link
                  href={`/forms/${encodeURIComponent(view.formId)}/response`}
                  className="shrink-0 text-paragraph-2 font-semibold text-brand-text hover:underline"
                >
                  View Application
                </Link>
              )}
            </div>
            <Description view={view} />
            <Timeline steps={view.steps} />
          </section>
          {view.nextSteps && <NextSteps items={view.nextSteps} />}
        </div>
      </div>
    </div>
  );
}

/**
 * Where the viewer's application stands and what to do next (#318). Reads
 * only the viewer's org-scoped form progress, so a form from another org, a
 * draft, or a missing config shows the empty state.
 */
export default async function ApplicationStatusWidget({
  organizationId,
  userId,
  audience,
  config,
}: WidgetProps) {
  const empty: ApplicationStatusView = {
    kind: "empty",
    message: NO_APPLICATION_MESSAGE,
  };
  if (!ApplicationStatusWidgetConfigSchema.safeParse(config).success) {
    return <ApplicationStatusWidgetView view={empty} />;
  }
  const [rows, features] = await Promise.all([
    FormProgressService.listForMember(
      organizationId,
      userId,
      memberTypeFromAudience(audience),
    ),
    OrganizationConfigService.getConfig(organizationId, [
      OrganizationConfigKey.FormsEnabled,
    ]),
  ]);
  const view = features[OrganizationConfigKey.FormsEnabled]
    ? getApplicationStatusView(config, rows)
    : empty;
  const firstName =
    view.kind === "application" &&
    view.status === SubmissionReviewStatus.Accepted
      ? getFirstName((await UserService.findById(userId))?.name)
      : null;
  return <ApplicationStatusWidgetView view={view} firstName={firstName} />;
}
