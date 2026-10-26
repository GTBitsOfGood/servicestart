"use client";

import { useEffect, useId, useRef, useState } from "react";
import ThemedDropdown from "@/components/theme/ThemedDropdown";
import api from "@/lib/api";
import { REVIEW_STATUS_LABELS } from "@/lib/forms/review";
import { SubmissionReviewStatus } from "@/lib/schema";

const STATUSES = Object.values(SubmissionReviewStatus);

/** Changes a submission's review status, rolling back if the save fails. */
export default function ReviewStatusDropdown({
  submissionId,
  initialStatus,
}: {
  submissionId: string;
  initialStatus: SubmissionReviewStatus;
}) {
  const labelId = useId();
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // BogDropdown keeps its own selection; remounting resets it on a rollback.
  const [rollbacks, setRollbacks] = useState(0);
  const groupRef = useRef<HTMLDivElement>(null);
  const wasSaving = useRef(false);

  // The trigger loses focus while it's disabled; give it back once saved.
  useEffect(() => {
    if (
      wasSaving.current &&
      !saving &&
      document.activeElement === document.body
    )
      groupRef.current?.querySelector("button")?.focus();
    wasSaving.current = saving;
  }, [saving]);

  async function change(next: SubmissionReviewStatus) {
    if (next === status || saving) return;
    const previous = status;
    setStatus(next);
    setSaving(true);
    setError(null);
    try {
      const response = await api.formResponses[":submissionId"].status.$patch({
        param: { submissionId },
        json: { status: next },
      });
      if (!response.ok) throw new Error(`Status ${response.status}`);
    } catch {
      setStatus(previous);
      setRollbacks((count) => count + 1);
      setError("Couldn't save the status. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={groupRef}
      role="group"
      aria-labelledby={labelId}
      aria-busy={saving}
      className="flex flex-col gap-2 tablet:items-end"
    >
      <span
        id={labelId}
        className="text-paragraph-2 font-semibold text-grey-text-strong"
      >
        Application status
      </span>
      <ThemedDropdown
        key={rollbacks}
        name="reviewStatus"
        options={STATUSES.map((value) => REVIEW_STATUS_LABELS[value])}
        value={REVIEW_STATUS_LABELS[status]}
        onSelectionChange={(label) => {
          const next = STATUSES.find(
            (value) => REVIEW_STATUS_LABELS[value] === label,
          );
          if (next) void change(next);
        }}
        disabled={saving}
        showClearIcon={false}
        className="w-48"
      />
      <p role="status" className="text-paragraph-2 text-grey-text-weak">
        {saving ? "Saving…" : ""}
      </p>
      {error && (
        <p role="alert" className="text-paragraph-2 text-status-red-text">
          {error}
        </p>
      )}
    </div>
  );
}
