"use client";

import type { CSSProperties } from "react";
import BogChip from "@/components/bog/BogChip/BogChip";
import {
  REVIEW_STATUS_CHIP_COLORS,
  REVIEW_STATUS_LABELS,
} from "@/features/forms/lib/review";
import { SubmissionReviewStatus } from "@/features/forms/schema";

/**
 * Theme-token colors (through BogChip's CSS variables) where the shared chip
 * color doesn't suit an applicant: Rejected is a neutral grey so the decision
 * doesn't read as an error, and BogChip's "amber" (gold on white) is too
 * faint to read (#318).
 */
const APPLICANT_CHIP_STYLES: Partial<
  Record<SubmissionReviewStatus, CSSProperties>
> = {
  [SubmissionReviewStatus.Pending]: {
    "--foreground": "var(--color-status-amber-text)",
    "--background": "var(--color-status-amber-fill)",
  } as CSSProperties,
  [SubmissionReviewStatus.Rejected]: {
    "--background": "var(--color-grey-fill-weak)",
  } as CSSProperties,
};

/** An applicant's own review status. */
export default function ReviewStatusChip({
  status,
}: {
  status: SubmissionReviewStatus;
}) {
  const style = APPLICANT_CHIP_STYLES[status];
  return (
    <BogChip
      color={style ? undefined : REVIEW_STATUS_CHIP_COLORS[status]}
      style={style}
      className="px-3 py-1"
    >
      {REVIEW_STATUS_LABELS[status]}
    </BogChip>
  );
}
