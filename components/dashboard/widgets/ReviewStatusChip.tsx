"use client";

import BogChip from "@/components/bog/BogChip/BogChip";
import {
  REVIEW_STATUS_CHIP_COLORS,
  REVIEW_STATUS_LABELS,
} from "@/lib/forms/review";
import { SubmissionReviewStatus } from "@/lib/schema";

/**
 * An applicant's own review status. Rejected uses the chip's default grey
 * rather than the admins' red, so the decision doesn't read as an error
 * (#318).
 */
export default function ReviewStatusChip({
  status,
}: {
  status: SubmissionReviewStatus;
}) {
  return (
    <BogChip
      color={
        status === SubmissionReviewStatus.Rejected
          ? undefined
          : REVIEW_STATUS_CHIP_COLORS[status]
      }
      className="px-3 py-1"
    >
      {REVIEW_STATUS_LABELS[status]}
    </BogChip>
  );
}
