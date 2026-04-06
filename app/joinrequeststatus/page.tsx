import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowClockwise,
  ArrowUpRight,
  Check,
  Clock,
  FileText,
  Question,
  X,
} from "@phosphor-icons/react/ssr";
import { auth } from "@/lib/auth";
import {
  createJoinRequestIfNeeded,
  getActiveOrganizationIdFromHeaders,
} from "@/lib/authUtils";
import { JoinRequestStatus } from "@/lib/schema";
import { JoinRequestsService } from "@/lib/services/JoinRequestService";
import { MembersService } from "@/lib/services/MemberService";
import { OrganizationsService } from "@/lib/services/OrganizationService";

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
  if (tone === "complete") {
    return (
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#57bc68] text-white">
        <Check size={20} weight="bold" />
      </span>
    );
  }

  if (tone === "current") {
    return (
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#f6bf50] text-white">
        <Clock size={18} weight="bold" />
      </span>
    );
  }

  if (tone === "denied") {
    return (
      <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#d14f42] text-white">
        <X size={20} weight="bold" />
      </span>
    );
  }

  return <span className="block h-[38px] w-[38px] rounded-full bg-[#d8d5d5]" />;
}

function getConnectorColors(state: Exclude<RequestCardState, "no_request">) {
  if (state === "approved") {
    return ["#57bc68", "#57bc68"] as const;
  }

  if (state === "pending") {
    return ["#57bc68", "#ddd9d9"] as const;
  }

  return ["#57bc68", "#ddd9d9"] as const;
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
      <section className="mt-[14px] flex min-h-[198px] items-center justify-center rounded-[22px] bg-[#f8f6f6] px-6 py-10 sm:px-10">
        <div className="flex max-w-[420px] flex-col items-center text-center">
          <FileText size={36} weight="regular" className="text-[#8f8488]" />
          <h2 className="mt-[14px] text-[23px] leading-[30px] font-normal text-[#5f5458]">
            No request found
          </h2>
          <p className="mt-[2px] text-[12px] leading-[18px] text-[#a49a9d]">
            You haven't submitted a join request for this organization yet.
          </p>

          <form action={onSubmit} className="mt-[14px]">
            <button
              type="submit"
              className="inline-flex h-[35px] items-center gap-[6px] rounded-[4px] bg-brand-text px-[13px] text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              <ArrowUpRight size={14} weight="bold" />
              <span className="leading-none">Submit a request</span>
            </button>
          </form>
        </div>
      </section>
    );
  }

  const tracker = getTrackerSteps(state, submittedAt);
  const connectorColors = getConnectorColors(state);

  return (
    <section className="mt-[14px] rounded-[22px] bg-[#f8f6f6] px-8 py-[54px] sm:px-12 lg:px-[42px]">
      <div className="mx-auto max-w-[980px]">
        {/* Desktop tracker */}
        <div className="relative hidden h-[38px] lg:block">
          {/* Line 1: from right edge of left circle to left edge of center circle */}
          <div
            className="absolute top-1/2 h-[2px] -translate-y-1/2"
            style={{
              backgroundColor: connectorColors[0],
              left: "calc(8% + 38px)",
              right: "calc(50% + 19px)",
            }}
          />
          {/* Line 2: from right edge of center circle to left edge of right circle */}
          <div
            className="absolute top-1/2 h-[2px] -translate-y-1/2"
            style={{
              backgroundColor: connectorColors[1],
              left: "calc(50% + 19px)",
              right: "calc(8% + 38px)",
            }}
          />
          {/* Left circle — pinned to left edge */}
          <div className="absolute left-[8%] top-0">
            <TrackerIcon tone={tracker.steps[0].tone} />
          </div>
          {/* Center circle — pinned to center */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2">
            <TrackerIcon tone={tracker.steps[1].tone} />
          </div>
          {/* Right circle — pinned to right edge */}
          <div className="absolute right-[8%] top-0">
            <TrackerIcon tone={tracker.steps[2].tone} />
          </div>
        </div>

        {/* Desktop labels — aligned under each circle */}
        <div className="mt-[10px] hidden lg:grid lg:grid-cols-3">
          <div className="flex flex-col items-center text-center">
            <h2
              className={`text-[18px] leading-[24px] font-normal ${tracker.steps[0].tone === "inactive" ? "text-[#9d9396]" : "text-[#3a2428]"}`}
            >
              {tracker.steps[0].title}
            </h2>
            {tracker.steps[0].description && (
              <p
                className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${tracker.steps[0].tone === "inactive" ? "text-[#b0a8aa]" : "text-[#a49a9d]"}`}
              >
                {tracker.steps[0].description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center text-center">
            <h2
              className={`text-[18px] leading-[24px] font-normal ${tracker.steps[1].tone === "inactive" ? "text-[#9d9396]" : "text-[#3a2428]"}`}
            >
              {tracker.steps[1].title}
            </h2>
            {tracker.steps[1].description && (
              <p
                className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${tracker.steps[1].tone === "inactive" ? "text-[#b0a8aa]" : "text-[#a49a9d]"}`}
              >
                {tracker.steps[1].description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center text-center">
            <h2
              className={`text-[18px] leading-[24px] font-normal ${tracker.steps[2].tone === "inactive" ? "text-[#9d9396]" : "text-[#3a2428]"}`}
            >
              {tracker.steps[2].title}
            </h2>
            {tracker.steps[2].description && (
              <p
                className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${tracker.steps[2].tone === "inactive" ? "text-[#b0a8aa]" : "text-[#a49a9d]"}`}
              >
                {tracker.steps[2].description}
              </p>
            )}
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
                className={`mt-[10px] text-[18px] leading-[24px] font-normal ${step.tone === "inactive" ? "text-[#9d9396]" : "text-[#3a2428]"}`}
              >
                {step.title}
              </h2>
              {step.description && (
                <p
                  className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${step.tone === "inactive" ? "text-[#b0a8aa]" : "text-[#a49a9d]"}`}
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

  const organizationId =
    await getActiveOrganizationIdFromHeaders(requestHeaders);

  if (!organizationId) {
    redirect("/");
  }

  const membership = await MembersService.findByUserAndOrganization(
    session.user.id,
    organizationId,
  );

  if (membership) {
    redirect("/");
  }

  const [organization, joinRequest] = await Promise.all([
    OrganizationsService.findById(organizationId),
    JoinRequestsService.findByUserAndOrganization(
      session.user.id,
      organizationId,
    ),
  ]);

  const status = joinRequest?.status ?? "missing";
  const cardState = STATUS_TO_CARD_STATE[status];
  const submittedAt = joinRequest?.createdAt ?? DEFAULT_UPDATED_AT;
  const lastUpdated =
    joinRequest?.updatedAt ?? joinRequest?.createdAt ?? DEFAULT_UPDATED_AT;

  async function submitJoinRequest() {
    "use server";

    await createJoinRequestIfNeeded(session.user.id, organizationId);
    redirect("/joinrequeststatus");
  }

  return (
    <main className="min-h-screen bg-[#fcfbfb] px-6 py-10 text-grey-text-strong sm:px-10 lg:px-16 lg:py-11">
      <div className="mx-auto max-w-[1110px]">
        <div className="ml-1">
          <div className="flex items-start gap-[5px]">
            <Image
              src="/logo.svg"
              alt="Bits of Good Sunset logo"
              width={47}
              height={47}
            />
            <div className="flex flex-col pt-[3px]">
              <Image src="/bog.svg" alt="bits of good" width={56} height={10} />
              <Image
                src="/sunset.svg"
                alt="sunset"
                width={88}
                height={18}
                className="mt-[2px]"
              />
            </div>
          </div>
        </div>

        <section className="pt-[62px]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-[32px] leading-[40px] font-normal tracking-[-0.02em] text-grey-text-strong">
                Join Request Status
              </h1>
              <p className="mt-6 text-[15px] leading-[22px] font-semibold text-grey-text-strong">
                [{organization?.name ?? "Organization Name"}]
              </p>
            </div>

            <div className="flex items-center gap-[10px] self-start lg:self-auto">
              <p className="text-[12px] leading-[18px] text-[#9f9598]">
                Last updated {formatDateTime(lastUpdated)}
              </p>
              <Link
                href="/joinrequeststatus"
                className="inline-flex h-[31px] items-center gap-[6px] rounded-[4px] border border-[#cfc7ca] bg-white px-[12px] text-[12px] font-semibold text-[#7c7376] transition hover:bg-[#faf7f7]"
              >
                <ArrowClockwise size={15} weight="regular" />
                <span className="leading-none">Refresh</span>
              </Link>
            </div>
          </div>

          <JoinRequestStatusCard
            state={cardState}
            submittedAt={submittedAt}
            onSubmit={submitJoinRequest}
          />

          <div className="mt-[16px] flex items-center justify-center gap-[6px] text-center text-[12px] leading-[18px] text-[#9f9598]">
            <Question
              size={16}
              weight="regular"
              className="shrink-0 text-[#9f9598]"
            />
            <p>
              Have questions?{" "}
              <span className="text-[#9f9598] underline underline-offset-2">
                Contact an organization admin
              </span>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
