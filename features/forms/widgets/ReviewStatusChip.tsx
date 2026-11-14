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
 * color doesn't suit a review status card: Rejected is a neutral grey so the decision
 * doesn't read as an error, and BogChip's "amber" (gold on white) is too
 * faint to read (#318).
 */
const REVIEW_STATUS_CHIP_OVERRIDES: Partial<
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

/** The member-facing review status chip. */
export default function ReviewStatusChip({
  status,
}: {
  status: SubmissionReviewStatus;
}) {
  const style = REVIEW_STATUS_CHIP_OVERRIDES[status];
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
