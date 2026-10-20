import { SubmissionReviewStatus } from "@/lib/schema";

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
