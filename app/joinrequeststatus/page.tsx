import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Check,
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
        <svg
          width="20"
          height="20"
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2.625 14C2.625 10.9832 3.82344 8.08988 5.95667 5.95667C8.08988 3.82344 10.9832 2.625 14 2.625C17.0168 2.625 19.9101 3.82344 22.0434 5.95667C24.1766 8.08988 25.375 10.9832 25.375 14C25.375 17.0168 24.1766 19.9101 22.0434 22.0434C19.9101 24.1766 17.0168 25.375 14 25.375C10.9832 25.375 8.08988 24.1766 5.95667 22.0434C3.82344 19.9101 2.625 17.0168 2.625 14ZM14 0C10.287 0 6.72602 1.475 4.10051 4.10051C1.475 6.72602 0 10.287 0 14C0 17.713 1.475 21.2741 4.10051 23.8996C6.72602 26.5249 10.287 28 14 28C17.713 28 21.2741 26.5249 23.8996 23.8996C26.5249 21.2741 28 17.713 28 14C28 10.287 26.5249 6.72602 23.8996 4.10051C21.2741 1.475 17.713 0 14 0ZM14.875 8.3125C14.875 7.96441 14.7367 7.63056 14.4906 7.38442C14.2444 7.13829 13.9106 7 13.5625 7C13.2144 7 12.8806 7.13829 12.6344 7.38442C12.3883 7.63056 12.25 7.96441 12.25 8.3125V14.4375C12.2501 14.6996 12.3286 14.9557 12.4755 15.1728C12.6224 15.3899 12.8309 15.558 13.0743 15.6555L17.4493 17.4055C17.7697 17.5226 18.1232 17.5102 18.4347 17.3711C18.7462 17.232 18.9914 16.977 19.1181 16.6602C19.2448 16.3435 19.2432 15.9898 19.1137 15.6742C18.9842 15.3586 18.7367 15.1058 18.424 14.9695L14.875 13.5485V8.3125Z"
            fill="white"
          />
        </svg>
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

function getTrackerTitleClass(tone: TrackerTone) {
  return tone === "inactive" ? "text-[#9d9396]" : "text-[#3a2428]";
}

function getTrackerDescriptionClass(tone: TrackerTone) {
  return tone === "inactive" ? "text-[#b0a8aa]" : "text-[#a49a9d]";
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
        <div className="relative mt-[10px] hidden min-h-[76px] lg:block">
          <div className="absolute left-[8%] top-0 w-[180px] -translate-x-[40%]">
            <div className="flex flex-col items-center text-center">
              <h2
                className={`text-[18px] leading-[24px] font-normal ${getTrackerTitleClass(tracker.steps[0].tone)}`}
              >
                {tracker.steps[0].title}
              </h2>
              {tracker.steps[0].description && (
                <p
                  className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${getTrackerDescriptionClass(tracker.steps[0].tone)}`}
                >
                  {tracker.steps[0].description}
                </p>
              )}
            </div>
          </div>

          <div className="absolute left-1/2 top-0 w-[200px] -translate-x-1/2">
            <div className="flex flex-col items-center text-center">
              <h2
                className={`text-[18px] leading-[24px] font-normal ${getTrackerTitleClass(tracker.steps[1].tone)}`}
              >
                {tracker.steps[1].title}
              </h2>
              {tracker.steps[1].description && (
                <p
                  className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${getTrackerDescriptionClass(tracker.steps[1].tone)}`}
                >
                  {tracker.steps[1].description}
                </p>
              )}
            </div>
          </div>

          <div className="absolute left-[92%] top-0 w-[180px] -translate-x-[60%]">
            <div className="flex flex-col items-center text-center">
              <h2
                className={`text-[18px] leading-[24px] font-normal ${getTrackerTitleClass(tracker.steps[2].tone)}`}
              >
                {tracker.steps[2].title}
              </h2>
              {tracker.steps[2].description && (
                <p
                  className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${getTrackerDescriptionClass(tracker.steps[2].tone)}`}
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
                className={`mt-[10px] text-[18px] leading-[24px] font-normal ${getTrackerTitleClass(step.tone)}`}
              >
                {step.title}
              </h2>
              {step.description && (
                <p
                  className={`mt-[4px] max-w-[210px] text-[12px] leading-[15px] ${getTrackerDescriptionClass(step.tone)}`}
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

  console.log("joinRequest:", joinRequest);
  const status = joinRequest?.status ?? "missing";
  console.log("status:", status);
  const cardState = STATUS_TO_CARD_STATE[status];
  console.log("cardState:", cardState);

  const submittedAt = joinRequest?.createdAt ?? DEFAULT_UPDATED_AT;
  const lastUpdated = joinRequest?.createdAt ?? DEFAULT_UPDATED_AT;

  async function submitJoinRequest() {
    "use server";

    await createJoinRequestIfNeeded(userId, activeOrganizationId);
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
                className="inline-flex items-center gap-[6px] rounded-[4px] border border-[#bfb5b8] bg-white px-[12px] py-[7px] text-[12px] font-semibold text-[#665b5f] transition hover:bg-[#faf7f7]"
              >
                <svg
                  width="20"
                  height="17"
                  viewBox="0 0 20 17"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M19.1667 1.66535V6.66535M19.1667 6.66535H14.1667M19.1667 6.66535L15.3 3.03201C14.4044 2.13594 13.2964 1.48135 12.0793 1.12932C10.8623 0.777297 9.57592 0.739305 8.34024 1.01889C7.10455 1.29848 5.95983 1.88654 5.01289 2.72819C4.06594 3.56985 3.34764 4.63767 2.925 5.83201M0.833332 14.9987V9.99868M0.833332 9.99868H5.83333M0.833332 9.99868L4.7 13.632C5.59562 14.5281 6.70364 15.1827 7.92067 15.5347C9.1377 15.8867 10.4241 15.9247 11.6598 15.6451C12.8954 15.3655 14.0402 14.7775 14.9871 13.9358C15.9341 13.0942 16.6524 12.0264 17.075 10.832"
                    stroke="#22070B"
                    strokeOpacity="0.7"
                    strokeWidth="1.66667"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
