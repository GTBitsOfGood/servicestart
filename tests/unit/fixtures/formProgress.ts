import { FormStatus, type SubmissionReviewStatus } from "@/lib/schema";
import type { MemberFormProgress } from "@/lib/services/FormProgressService";

/** A row as FormProgressService.listForMember returns it, keyed by formId. */
export function progressRow(
  formId: string,
  {
    required = true,
    availability = "open",
    reviewStatus = null,
    dueAt = null,
  }: {
    required?: boolean;
    availability?: MemberFormProgress["form"]["availability"];
    reviewStatus?: SubmissionReviewStatus | null;
    dueAt?: string | null;
  } = {},
): MemberFormProgress {
  return {
    form: {
      id: `uuid-${formId}`,
      formId,
      title: `Title ${formId}`,
      description: null,
      status: FormStatus.Published,
      opensAt: availability === "not_yet_open" ? "2030-01-01T00:00:00Z" : null,
      closesAt: null,
      dueAt,
      availability,
    },
    required,
    submission: reviewStatus && {
      id: `sub-${formId}`,
      submittedAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: null,
      reviewStatus,
    },
  };
}
