"use client";

import Link from "next/link";
import BogChip from "@/components/bog/BogChip/BogChip";
import RequestInformationModal from "@/components/forms/RequestInformationModal";
import LocalDateTime from "@/components/forms/LocalDateTime";
import {
  REQUIRED_FORM_STATUS_CHIP_COLORS,
  REQUIRED_FORM_STATUS_LABELS,
  type RequiredFormStatus,
} from "@/lib/forms/review";

export type RequiredFormItem = {
  formId: string;
  title: string;
  dueAt: string | null;
  status: RequiredFormStatus;
  /** Set when the form is completed. */
  submissionId: string | null;
  /** Whether a request can be sent: the form isn't submitted and is open. */
  canRequest: boolean;
};

/** The other forms a member is required to fill out, and where they stand. */
export default function RequiredFormsPanel({
  member,
  forms,
}: {
  member: { id: string; name: string };
  forms: RequiredFormItem[];
}) {
  return (
    <section
      aria-labelledby="required-forms-heading"
      className="flex flex-col gap-4 rounded-lg border border-grey-stroke-weak bg-solid-bg-base p-6"
    >
      <h2
        id="required-forms-heading"
        className="font-display text-heading-4 text-page-text"
      >
        Other required forms
      </h2>
      {forms.length === 0 ? (
        <p className="text-paragraph-2 text-grey-text-weak">
          No other forms are required.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-grey-stroke-weak">
          {forms.map((form) => (
            <li
              key={form.formId}
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  {form.submissionId ? (
                    <Link
                      href={`/settings/forms/${encodeURIComponent(form.formId)}/responses/${form.submissionId}`}
                      className="text-paragraph-1 font-semibold text-brand-text hover:opacity-80"
                    >
                      {form.title}
                    </Link>
                  ) : (
                    <span className="text-paragraph-1 font-semibold text-grey-text-strong">
                      {form.title}
                    </span>
                  )}
                  {form.dueAt && (
                    <span className="text-paragraph-2 text-grey-text-weak">
                      Due <LocalDateTime iso={form.dueAt} />
                    </span>
                  )}
                </div>
                <BogChip
                  size="1"
                  color={REQUIRED_FORM_STATUS_CHIP_COLORS[form.status]}
                >
                  {REQUIRED_FORM_STATUS_LABELS[form.status]}
                </BogChip>
              </div>
              {form.canRequest && (
                <div>
                  <RequestInformationModal
                    userId={member.id}
                    memberName={member.name}
                    form={form}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
