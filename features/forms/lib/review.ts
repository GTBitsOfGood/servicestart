import {
  FormComponentType,
  SubmissionReviewStatus,
} from "@/features/forms/schema";
import type { FormComponent } from "@/features/forms/lib/schema";
import type { MemberFormProgress } from "@/features/forms/services/FormProgressService";
import { z } from "zod";

export const ReviewStatusSchema = z.object({
  status: z.enum(SubmissionReviewStatus),
});
export const BulkReviewStatusSchema = ReviewStatusSchema.extend({
  submissionIds: z.array(z.uuid()).min(1).max(100),
}).strict();
export const ResponseListQuerySchema = z.strictObject({
  status: z.enum(SubmissionReviewStatus).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .default(0),
});

export const ReviewNotificationMetadataSchema = z.object({
  kind: z.literal("form_review"),
  href: z.literal("/"),
  submissionId: z.uuid(),
});

/*
 * How review statuses read everywhere they're shown: the responses pages
 * (#316, #317) and the applicant's status card (#318).
 */

export const REVIEW_STATUS_LABELS: Record<SubmissionReviewStatus, string> = {
  [SubmissionReviewStatus.Pending]: "Pending",
  [SubmissionReviewStatus.UnderReview]: "Under Review",
  [SubmissionReviewStatus.Accepted]: "Accepted",
  [SubmissionReviewStatus.Rejected]: "Rejected",
};

/** The `BogChip` color for each status, matching the Figma's chips. */
export const REVIEW_STATUS_CHIP_COLORS = {
  [SubmissionReviewStatus.Pending]: "amber",
  [SubmissionReviewStatus.UnderReview]: "blue",
  [SubmissionReviewStatus.Accepted]: "green",
  [SubmissionReviewStatus.Rejected]: "red",
} as const satisfies Record<SubmissionReviewStatus, string>;

/** A form's questions split at its section headers, each led by its header. */
export function splitSections<C extends Pick<FormComponent, "type">>(
  components: C[],
): C[][] {
  const sections: C[][] = [];
  for (const component of components) {
    if (
      component.type === FormComponentType.SectionHeader ||
      sections.length === 0
    )
      sections.push([]);
    sections[sections.length - 1].push(component);
  }
  return sections;
}

/** Where a member stands on a form they're required to fill out. */
export type RequiredFormStatus = "completed" | "not-submitted" | "past-due";

export const REQUIRED_FORM_STATUS_LABELS: Record<RequiredFormStatus, string> = {
  completed: "Completed",
  "not-submitted": "Not Submitted",
  "past-due": "Past due",
};

export const REQUIRED_FORM_STATUS_CHIP_COLORS = {
  completed: "green",
  "not-submitted": "gray",
  "past-due": "red",
} as const satisfies Record<RequiredFormStatus, string>;

export function getRequiredFormStatus(
  progress: Pick<MemberFormProgress, "submission"> & {
    form: Pick<MemberFormProgress["form"], "dueAt">;
  },
  now = new Date(),
): RequiredFormStatus {
  if (progress.submission) return "completed";
  return progress.form.dueAt && Date.parse(progress.form.dueAt) < now.getTime()
    ? "past-due"
    : "not-submitted";
}
