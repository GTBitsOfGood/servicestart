import { SubmissionReviewStatus } from "@/lib/schema";
import { z } from "zod";

export const ReviewStatusSchema = z.object({
  status: z.enum(SubmissionReviewStatus),
});
export const BulkReviewStatusSchema = ReviewStatusSchema.extend({
  submissionIds: z.array(z.uuid()).min(1).max(100),
});
export const ResponseListQuerySchema = z.object({
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
