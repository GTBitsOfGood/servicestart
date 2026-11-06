import { ApplicationStatusWidgetConfigSchema } from "@/features/dashboard/lib/schema";
import { SubmissionReviewStatus } from "@/features/forms/schema";
import type { MemberFormProgress } from "@/features/forms/services/FormProgressService";

export type TimelineStepState = "complete" | "current" | "upcoming";

export type TimelineStep = {
  label: string;
  description: string;
  state: TimelineStepState;
  /** A complete step shown without the brand color (a rejection). */
  neutral?: boolean;
};

export type NextStep = {
  formId: string;
  title: string;
  dueAt: string | null;
  done: boolean;
};

export type ApplicationStatusView =
  | { kind: "empty"; message: string }
  | {
      kind: "application";
      formId: string;
      title: string;
      /** Null until they submit. */
      status: SubmissionReviewStatus | null;
      availability: MemberFormProgress["form"]["availability"];
      dueAt: string | null;
      opensAt: string | null;
      steps: TimelineStep[];
      /** Null when the pane is hidden (a rejection). */
      nextSteps: NextStep[] | null;
    };

export const NO_APPLICATION_MESSAGE =
  "There's no application to show right now.";
export const APPLICATIONS_CLOSED_MESSAGE = "Applications are closed.";

/** How many timeline steps are complete, and which is current, per status. */
const TIMELINE: Record<
  SubmissionReviewStatus | "not_started",
  { complete: number; current?: number }
> = {
  not_started: { complete: 0 },
  [SubmissionReviewStatus.Pending]: { complete: 1 },
  [SubmissionReviewStatus.UnderReview]: { complete: 1, current: 1 },
  [SubmissionReviewStatus.Accepted]: { complete: 3 },
  [SubmissionReviewStatus.Rejected]: { complete: 3 },
};

/**
 * What the application status widget shows, from its config and the viewer's
 * form progress (FormProgressService.listForMember, already org-scoped). Any
 * config or form it can't use gives the empty state.
 */
export function getApplicationStatusView(
  config: unknown,
  rows: MemberFormProgress[],
): ApplicationStatusView {
  const parsed = ApplicationStatusWidgetConfigSchema.safeParse(config);
  if (!parsed.success)
    return { kind: "empty", message: NO_APPLICATION_MESSAGE };
  const { formId, steps } = parsed.data;

  const app = rows.find((row) => row.form.formId === formId);
  if (!app) return { kind: "empty", message: NO_APPLICATION_MESSAGE };
  const status = app.submission?.reviewStatus ?? null;
  if (!status && app.form.availability === "closed") {
    return { kind: "empty", message: APPLICATIONS_CLOSED_MESSAGE };
  }

  const rejected = status === SubmissionReviewStatus.Rejected;
  const { complete, current } = TIMELINE[status ?? "not_started"];

  const items = rows
    .filter(
      ({ required, form, submission }) =>
        required &&
        form.formId !== formId &&
        (form.availability === "open" ||
          (form.availability === "closed" && submission)),
    )
    .map(({ form, submission }) => ({
      formId: form.formId,
      title: form.title,
      dueAt: form.dueAt,
      done: submission !== null,
    }));

  return {
    kind: "application",
    formId,
    title: app.form.title,
    status,
    availability: app.form.availability,
    dueAt: app.form.dueAt,
    opensAt: app.form.opensAt,
    steps: steps.map((step, index) => ({
      ...step,
      state:
        index < complete
          ? "complete"
          : index === current
            ? "current"
            : "upcoming",
      ...(rejected && index === 2 && { neutral: true }),
    })),
    // To do first, then done; each already soonest due first.
    nextSteps: rejected
      ? null
      : [...items.filter((i) => !i.done), ...items.filter((i) => i.done)],
  };
}

/** The first word of a name, or null if there isn't one. */
export function getFirstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] || null;
}
