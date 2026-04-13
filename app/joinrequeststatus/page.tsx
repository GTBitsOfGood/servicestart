import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  ClockIcon,
  FileDashedIcon,
  QuestionIcon,
  XCircleIcon,
} from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  createJoinRequestIfNeeded,
  getActiveOrganizationIdFromHeaders,
} from "@/lib/authUtils";
import { JoinRequestStatus } from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationsService } from "@/lib/services/OrganizationService";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Join Request Status" };

const DEFAULT_UPDATED_AT = new Date("2026-02-25T15:00:00");

type StepStatus = "complete" | "clock" | "denied" | "upcoming";
type Step = { title: string; subtitle?: string; status: StepStatus };

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function formatDateTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function getSteps(status: JoinRequestStatus, createdAt: Date): Step[] {
  const submitted = `Submitted on ${formatDate(createdAt)}`;
  const reviewDate = new Date(createdAt);
  reviewDate.setDate(reviewDate.getDate() + 1);
  const reviewed = `Reviewed ${formatDate(reviewDate)}`;
  switch (status) {
    case JoinRequestStatus.Pending:
      return [
        { title: "Request submitted", subtitle: submitted, status: "complete" },
        {
          title: "Pending review",
          subtitle: "You will be notified once a decision is made",
          status: "clock",
        },
        { title: "Decision", status: "upcoming" },
      ];
    case JoinRequestStatus.Approved:
      return [
        { title: "Request submitted", subtitle: submitted, status: "complete" },
        { title: "Reviewed", subtitle: reviewed, status: "complete" },
        {
          title: "Approved",
          subtitle: "Your join request has been approved",
          status: "complete",
        },
      ];
    case JoinRequestStatus.Denied:
      return [
        { title: "Request submitted", subtitle: submitted, status: "complete" },
        { title: "Reviewed", subtitle: reviewed, status: "complete" },
        {
          title: "Request denied",
          subtitle: "If you think this was a mistake, please contact an admin",
          status: "denied",
        },
      ];
  }
}

const STEP_ICONS = {
  complete: {
    icon: CheckCircleIcon,
    bg: "bg-join-step-complete",
    sm: 27,
    lg: 36,
  },
  clock: { icon: ClockIcon, bg: "bg-join-step-pending", sm: 21, lg: 28 },
  denied: { icon: XCircleIcon, bg: "bg-status-red-text", sm: 22.5, lg: 30 },
} as const;

function StepIcon({ status, size }: { status: StepStatus; size: "sm" | "lg" }) {
  const base = cn(
    size === "sm" ? "size-9" : "size-12",
    "flex shrink-0 items-center justify-center rounded-full",
  );

  if (status === "upcoming") {
    return (
      <div className={cn(base, "bg-media-divider lg:bg-grey-off-state")} />
    );
  }

  const { icon: Icon, bg, [size]: iconSize } = STEP_ICONS[status];

  return (
    <div className={cn(base, bg)}>
      <Icon weight="fill" className="text-white" size={iconSize} />
    </div>
  );
}

function StepLabel({ step }: { step: Step }) {
  const titleClass =
    step.status === "upcoming"
      ? "text-heading-4 font-semibold text-[#8e8082] lg:text-heading-3 lg:text-grey-stroke-strong"
      : "text-heading-4 font-semibold text-grey-text-strong lg:text-heading-3";

  return (
    <>
      <span className={titleClass}>{step.title}</span>
      {step.subtitle && (
        <span className="text-paragraph-2 font-normal leading-normal text-grey-stroke-strong">
          {step.subtitle}
        </span>
      )}
    </>
  );
}

function Stepper({ steps }: { steps: Step[] }) {
  const lineBg = (s: Step) =>
    s.status === "complete" ? "bg-join-step-complete" : "bg-grey-off-state";

  return (
    <>
      <div className="flex flex-col gap-8 lg:hidden">
        {steps.map((step, i) => (
          <div key={step.title} className="flex items-start gap-4">
            <div className="flex shrink-0 flex-col items-center">
              <StepIcon status={step.status} size="sm" />
              {i < steps.length - 1 && (
                <div className={cn("my-1 min-h-8 w-px flex-1", lineBg(step))} />
              )}
            </div>
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-1 pt-0.5",
                i < steps.length - 1 ? "pb-0" : "",
              )}
            >
              <StepLabel step={step} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden w-full items-start lg:flex">
        {steps.map((step, i) => (
          <Fragment key={step.title}>
            <div className="flex w-join-step shrink-0 flex-col items-center gap-4">
              <StepIcon status={step.status} size="lg" />
              <div className="flex w-full flex-col items-center gap-2 text-center">
                <StepLabel step={step} />
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mt-6 h-0.5 min-w-0 flex-1 self-start",
                  lineBg(step),
                )}
              />
            )}
          </Fragment>
        ))}
      </div>
    </>
  );
}

export default async function JoinRequestStatusPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const organizationId =
    await getActiveOrganizationIdFromHeaders(requestHeaders);
  if (!organizationId) redirect("/");
  const activeOrgId = organizationId;

  const membership = await MembersService.findByUserAndOrganization(
    userId,
    activeOrgId,
  );
  if (membership) redirect("/");

  const [organization, joinRequest] = await Promise.all([
    OrganizationsService.findById(activeOrgId),
    JoinRequestsService.findByUserAndOrganization(userId, activeOrgId),
  ]);

  const lastUpdated = joinRequest?.createdAt ?? DEFAULT_UPDATED_AT;
  const lastUpdatedText = `Last updated ${formatDateTime(lastUpdated)}`;

  async function submitJoinRequest() {
    "use server";
    await createJoinRequestIfNeeded(userId, activeOrgId);
    redirect("/joinrequeststatus");
  }

  const refreshBtnClass =
    "inline-flex items-center justify-center gap-1 rounded border border-solid border-grey-stroke-strong pl-4 pr-3 py-2 text-paragraph-1 font-normal text-grey-text-weak hover:bg-grey-fill-weak";

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-grey-text-strong sm:px-10 lg:px-16 lg:py-11">
      <div className="mx-auto max-w-7xl">
        <div className="ml-1 flex items-start gap-1">
          <Image
            src="/logo.svg"
            alt="Bits of Good Sunset logo"
            width={47}
            height={47}
          />
          <div className="flex flex-col pt-1">
            <Image src="/bog.svg" alt="bits of good" width={56} height={10} />
            <Image
              src="/sunset.svg"
              alt="sunset"
              width={88}
              height={18}
              className="mt-0.5"
            />
          </div>
        </div>

        <section className="pt-8 lg:pt-10">
          <div className="flex items-center justify-between gap-4">
            <h1
              data-testid="join-request-status-heading"
              className="text-heading-2 font-bold text-grey-text-strong lg:text-heading-1"
            >
              Join Request Status
            </h1>
            <span
              className="shrink-0 text-grey-icon-strong lg:hidden"
              aria-hidden
            >
              <QuestionIcon size={24} />
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-4 lg:mt-8 lg:flex-row lg:items-end lg:justify-between">
            <p className="text-heading-4 font-semibold text-grey-text-strong">
              {organization.name ?? "Organization Name"}
            </p>
            <div className="hidden shrink-0 items-end gap-4 lg:flex">
              <span className="text-paragraph-1 font-normal text-grey-stroke-strong">
                {lastUpdatedText}
              </span>
              <Link href="/joinrequeststatus" className={refreshBtnClass}>
                <ArrowsClockwiseIcon size={20} className="shrink-0" />
                Refresh
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-solid-bg-sunken p-8 lg:mt-8 lg:px-14 lg:py-10">
            {joinRequest ? (
              <Stepper
                steps={getSteps(joinRequest.status, joinRequest.createdAt)}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 py-2 text-center lg:py-4">
                <FileDashedIcon className="size-12 text-grey-text-strong/30 lg:size-16" />
                <div className="flex max-w-md flex-col gap-1">
                  <p className="text-heading-4 font-semibold text-grey-text-strong lg:text-heading-3">
                    No request found
                  </p>
                  <p className="text-paragraph-2 font-normal text-grey-stroke-strong">
                    You haven&apos;t submitted a join request for this
                    organization yet.
                  </p>
                </div>
                <form action={submitJoinRequest}>
                  <button
                    type="submit"
                    className="mt-1 h-10 rounded bg-brand-text px-5 text-paragraph-1 font-semibold text-white lg:h-11 lg:px-6"
                  >
                    Submit a request
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="mt-8 hidden items-center justify-center gap-2 text-paragraph-1 font-normal text-grey-stroke-strong lg:flex">
            <QuestionIcon size={20} className="shrink-0" />
            <p>
              Have questions?{" "}
              <span className="underline decoration-solid underline-offset-2">
                Contact an organization admin
              </span>
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:hidden">
            <Link
              href="/joinrequeststatus"
              className={cn(refreshBtnClass, "w-full")}
            >
              <ArrowsClockwiseIcon size={20} className="shrink-0" />
              Refresh
            </Link>
            <p className="text-center text-paragraph-2 font-normal text-grey-stroke-strong">
              {lastUpdatedText}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
