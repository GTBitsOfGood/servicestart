import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ApprovedStatusIcon from "./components/icons/ApprovedStatusIcon";
import DeniedStatusIcon from "./components/icons/DeniedStatusIcon";
import ExternalLinkIcon from "./components/icons/ExternalLinkIcon";
import HelpIcon from "./components/icons/HelpIcon";
import NoRequestIcon from "./components/icons/NoRequestIcon";
import PendingStatusIcon from "./components/icons/PendingStatusIcon";
import RefreshIcon from "./components/icons/RefreshIcon";
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

export const metadata = {
  title: "Join Request Status",
};

type RequestCardState = "no_request" | "pending" | "approved" | "denied";

type TrackerTone = "complete" | "current" | "inactive" | "denied";

type TrackerStep = {
  title: string;
  description?: string;
  tone: TrackerTone;
};

const TRACKER_ICON_BASE_CLASS =
  "flex size-10 items-center justify-center rounded-full text-white";

const TRACKER_TONE_STYLES: Record<
  TrackerTone,
  {
    description: string;
    iconClass: string;
    title: string;
  }
> = {
  complete: {
    description: "text-grey-text-weak",
    iconClass: "bg-status-active",
    title: "text-grey-text-strong",
  },
  current: {
    description: "text-grey-text-weak",
    iconClass: "bg-amber-400",
    title: "text-grey-text-strong",
  },
  denied: {
    description: "text-grey-text-weak",
    iconClass: "bg-status-red-text",
    title: "text-grey-text-strong",
  },
  inactive: {
    description: "text-stone-400",
    iconClass: "bg-stone-300 text-transparent",
    title: "text-stone-500",
  },
};

const STATUS_TO_CARD_STATE: Record<
  JoinRequestStatus | "missing",
  RequestCardState
> = {
  [JoinRequestStatus.Pending]: "pending",
  [JoinRequestStatus.Approved]: "approved",
  [JoinRequestStatus.Denied]: "denied",
  missing: "no_request",
};

const DEFAULT_UPDATED_AT = new Date("2026-02-25T15:00:00");

function formatDateTime(value: Date) {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);

  return `${date} at ${time}`;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getTrackerSteps(
  state: Exclude<RequestCardState, "no_request">,
  submittedAt: Date,
) {
  const submittedLabel = `Submitted on ${formatShortDate(submittedAt)}`;
  const reviewedAt = addDays(submittedAt, 1);
  const reviewedLabel = `Reviewed ${formatShortDate(reviewedAt)}`;

  if (state === "pending") {
    return {
      steps: [
        {
          title: "Request submitted",
          description: submittedLabel,
          tone: "complete",
        },
        {
          title: "Pending review",
          description: "You will be notified once a decision is made",
          tone: "current",
        },
        {
          title: "Decision",
          tone: "inactive",
        },
      ] satisfies TrackerStep[],
    };
  }

  if (state === "approved") {
    return {
      steps: [
        {
          title: "Request submitted",
          description: submittedLabel,
          tone: "complete",
        },
        {
          title: "Reviewed",
          description: reviewedLabel,
          tone: "complete",
        },
        {
          title: "Approved",
          description: "Your join request has been approved",
          tone: "complete",
        },
      ] satisfies TrackerStep[],
    };
  }

  return {
    steps: [
      {
        title: "Request submitted",
        description: submittedLabel,
        tone: "complete",
      },
      {
        title: "Reviewed",
        description: reviewedLabel,
        tone: "complete",
      },
      {
        title: "Request denied",
        description: "If you think this was a mistake, please contact an admin",
        tone: "denied",
      },
    ] satisfies TrackerStep[],
  };
}

function TrackerIcon({ tone }: { tone: TrackerTone }) {
  const iconClass = cn(
    TRACKER_ICON_BASE_CLASS,
    TRACKER_TONE_STYLES[tone].iconClass,
  );

  if (tone === "complete") {
    return (
      <span className={iconClass}>
        <ApprovedStatusIcon />
      </span>
    );
  }

  if (tone === "current") {
    return (
      <span className={iconClass}>
        <PendingStatusIcon />
      </span>
    );
  }

  if (tone === "denied") {
    return (
      <span className={iconClass}>
        <DeniedStatusIcon />
      </span>
    );
  }

  return <span className={iconClass} />;
}

function getConnectorClasses(state: Exclude<RequestCardState, "no_request">) {
  if (state === "approved") {
    return ["bg-status-active", "bg-status-active"] as const;
  }

  if (state === "pending") {
    return ["bg-status-active", "bg-stone-300"] as const;
  }

  return ["bg-status-active", "bg-stone-300"] as const;
}

function getTrackerTitleClass(tone: TrackerTone) {
  return TRACKER_TONE_STYLES[tone].title;
}

function getTrackerDescriptionClass(tone: TrackerTone) {
  return TRACKER_TONE_STYLES[tone].description;
}

function JoinRequestStatusCard({
  state,
  submittedAt,
  onSubmit,
}: {
  state: RequestCardState;
  submittedAt: Date;
  onSubmit: () => Promise<void>;
}) {
  if (state === "no_request") {
    return (
      <section className="mt-3.5 flex min-h-50 items-center justify-center rounded-3xl bg-stone-50 px-6 py-10 sm:px-10">
        <div className="flex max-w-xl flex-col items-center text-center">
          <NoRequestIcon className="text-stone-500" />
          <h2 className="mt-3.5 text-2xl leading-8 font-normal text-stone-600">
            No request found
          </h2>
          <p className="mt-0.5 text-xs leading-4 text-grey-text-weak">
            You haven't submitted a join request for this organization yet.
          </p>

          <form action={onSubmit} className="mt-3.5">
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded bg-brand-text px-3.5 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <ExternalLinkIcon />
              <span className="leading-none">Submit a request</span>
            </button>
          </form>
        </div>
      </section>
    );
  }

  const tracker = getTrackerSteps(state, submittedAt);
  const connectorClasses = getConnectorClasses(state);

  return (
    <section className="mt-3.5 rounded-3xl bg-stone-50 px-8 py-14 sm:px-12 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {/* Desktop tracker */}
        <div className="hidden px-10 lg:block xl:px-16">
          <div className="flex items-center">
            <TrackerIcon tone={tracker.steps[0].tone} />
            <div className={cn("h-0.5 flex-1", connectorClasses[0])} />
            <TrackerIcon tone={tracker.steps[1].tone} />
            <div className={cn("h-0.5 flex-1", connectorClasses[1])} />
            <TrackerIcon tone={tracker.steps[2].tone} />
          </div>

          {/* Desktop labels — aligned under each circle */}
          <div className="mt-2.5 grid min-h-20 grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center">
              <h2
                className={cn(
                  "text-lg leading-6 font-normal",
                  getTrackerTitleClass(tracker.steps[0].tone),
                )}
              >
                {tracker.steps[0].title}
              </h2>
              {tracker.steps[0].description && (
                <p
                  className={cn(
                    "mt-1 max-w-52 text-xs leading-4",
                    getTrackerDescriptionClass(tracker.steps[0].tone),
                  )}
                >
                  {tracker.steps[0].description}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center text-center">
              <h2
                className={cn(
                  "text-lg leading-6 font-normal",
                  getTrackerTitleClass(tracker.steps[1].tone),
                )}
              >
                {tracker.steps[1].title}
              </h2>
              {tracker.steps[1].description && (
                <p
                  className={cn(
                    "mt-1 max-w-52 text-xs leading-4",
                    getTrackerDescriptionClass(tracker.steps[1].tone),
                  )}
                >
                  {tracker.steps[1].description}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center text-center">
              <h2
                className={cn(
                  "text-lg leading-6 font-normal",
                  getTrackerTitleClass(tracker.steps[2].tone),
                )}
              >
                {tracker.steps[2].title}
              </h2>
              {tracker.steps[2].description && (
                <p
                  className={cn(
                    "mt-1 max-w-52 text-xs leading-4",
                    getTrackerDescriptionClass(tracker.steps[2].tone),
                  )}
                >
                  {tracker.steps[2].description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile — stacked vertically */}
        <div className="grid gap-10 lg:hidden">
          {tracker.steps.map((step) => (
            <div
              key={step.title}
              className="flex flex-col items-center text-center"
            >
              <TrackerIcon tone={step.tone} />
              <h2
                className={cn(
                  "mt-2.5 text-lg leading-6 font-normal",
                  getTrackerTitleClass(step.tone),
                )}
              >
                {step.title}
              </h2>
              {step.description && (
                <p
                  className={cn(
                    "mt-1 max-w-52 text-xs leading-4",
                    getTrackerDescriptionClass(step.tone),
                  )}
                >
                  {step.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function JoinRequestStatusPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;

  const organizationId =
    await getActiveOrganizationIdFromHeaders(requestHeaders);

  if (!organizationId) {
    redirect("/");
  }

  const activeOrganizationId = organizationId;

  const membership = await MembersService.findByUserAndOrganization(
    userId,
    activeOrganizationId,
  );

  if (membership) {
    redirect("/");
  }

  const [organization, joinRequest] = await Promise.all([
    OrganizationsService.findById(activeOrganizationId),
    JoinRequestsService.findByUserAndOrganization(userId, activeOrganizationId),
  ]);

  const status = joinRequest?.status ?? "missing";
  const cardState = STATUS_TO_CARD_STATE[status];

  const submittedAt = joinRequest?.createdAt ?? DEFAULT_UPDATED_AT;
  const lastUpdated = joinRequest?.createdAt ?? DEFAULT_UPDATED_AT;

  async function submitJoinRequest() {
    "use server";

    await createJoinRequestIfNeeded(userId, activeOrganizationId);
    redirect("/joinrequeststatus");
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10 text-grey-text-strong sm:px-10 lg:px-16 lg:py-11">
      <div className="mx-auto max-w-7xl">
        <div className="ml-1">
          <div className="flex items-start gap-1">
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
        </div>

        <section className="pt-16">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-heading-2 leading-10 font-normal tracking-tight text-grey-text-strong">
                Join Request Status
              </h1>
              <p className="mt-6 text-paragraph-2 font-semibold text-grey-text-strong">
                [{organization?.name ?? "Organization Name"}]
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start lg:self-auto">
              <p className="text-xs leading-4 text-stone-500">
                Last updated {formatDateTime(lastUpdated)}
              </p>
              <Link
                href="/joinrequeststatus"
                className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
              >
                <RefreshIcon className="text-grey-text-strong" />
                <span className="leading-none">Refresh</span>
              </Link>
            </div>
          </div>

          <JoinRequestStatusCard
            state={cardState}
            submittedAt={submittedAt}
            onSubmit={submitJoinRequest}
          />

          <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs leading-4 text-stone-500">
            <HelpIcon className="shrink-0 text-stone-500" />
            <p>
              Have questions?{" "}
              <span className="text-stone-500 underline underline-offset-2">
                Contact an organization admin
              </span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
