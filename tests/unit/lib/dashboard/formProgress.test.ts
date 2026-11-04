// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FormStatus, MemberType, SubmissionReviewStatus } from "@/lib/schema";
import type { DashboardAudience } from "@/lib/dashboard/audience";
import {
  memberTypeFromAudience,
  summarizeFormProgress,
} from "@/lib/dashboard/formProgress";
import type { MemberFormProgress } from "@/lib/services/FormProgressService";

const NOW = new Date("2027-03-15T12:00:00Z");

const DEFAULT_FORM: MemberFormProgress["form"] = {
  id: "11111111-1111-4111-8111-111111111111",
  formId: "emergency-contact",
  title: "Emergency Contact",
  description: null,
  status: FormStatus.Published,
  opensAt: null,
  closesAt: null,
  dueAt: "2027-04-01T00:00:00Z",
  availability: "open",
};

function progressRow(
  overrides: Omit<Partial<MemberFormProgress>, "form"> & {
    form?: Partial<MemberFormProgress["form"]>;
  } = {},
): MemberFormProgress {
  return {
    required: overrides.required ?? true,
    submission: overrides.submission ?? null,
    form: { ...DEFAULT_FORM, ...overrides.form },
  };
}

describe("memberTypeFromAudience", () => {
  it.each([
    ["attendee", MemberType.Attendee],
    ["applicant", MemberType.Applicant],
    ["admin", null],
    ["member", null],
  ] as const satisfies readonly [DashboardAudience, MemberType | null][])(
    "maps %s to %s",
    (audience, memberType) => {
      expect(memberTypeFromAudience(audience)).toBe(memberType);
    },
  );
});

describe("summarizeFormProgress", () => {
  it("puts required unsubmitted forms in todo and submitted forms in completed", () => {
    const rows = [
      progressRow({ submission: null }),
      progressRow({
        form: {
          id: "22222222-2222-4222-8222-222222222222",
          formId: "consent",
          title: "Consent",
        },
        submission: {
          id: "sub-1",
          submittedAt: new Date("2027-03-01T00:00:00Z"),
          updatedAt: null,
          reviewStatus: SubmissionReviewStatus.Pending,
        },
      }),
    ];

    const { todo, completed } = summarizeFormProgress(rows, NOW);

    expect(todo).toHaveLength(1);
    expect(todo[0].title).toBe("Emergency Contact");
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe("Consent");
  });

  it("counts only required forms in the gauge", () => {
    const rows = [
      progressRow({ submission: null }),
      progressRow({
        required: false,
        submission: {
          id: "sub-optional",
          submittedAt: new Date("2027-03-01T00:00:00Z"),
          updatedAt: null,
          reviewStatus: SubmissionReviewStatus.Pending,
        },
      }),
      progressRow({
        form: {
          id: "33333333-3333-4333-8333-333333333333",
          formId: "medical",
          title: "Medical",
        },
        submission: {
          id: "sub-2",
          submittedAt: new Date("2027-03-02T00:00:00Z"),
          updatedAt: null,
          reviewStatus: SubmissionReviewStatus.Pending,
        },
      }),
    ];

    const { completed, gauge } = summarizeFormProgress(rows, NOW);

    expect(completed).toHaveLength(2);
    expect(gauge).toEqual({ done: 1, total: 2 });
  });

  it("marks a todo as past due when dueAt is before now", () => {
    const { todo } = summarizeFormProgress(
      [
        progressRow({
          form: { dueAt: "2027-03-01T00:00:00Z", availability: "open" },
        }),
      ],
      NOW,
    );

    expect(todo[0].pastDue).toBe(true);
  });

  it("models todo actions as a discriminated union on availability", () => {
    const summary = summarizeFormProgress(
      [
        progressRow({
          form: {
            formId: "open-form",
            availability: "open",
          },
        }),
        progressRow({
          form: {
            id: "44444444-4444-4444-8444-444444444444",
            formId: "future",
            title: "Future",
            availability: "not_yet_open",
          },
        }),
        progressRow({
          form: {
            id: "55555555-5555-4555-8555-555555555555",
            formId: "closed-form",
            title: "Closed",
            availability: "closed",
          },
        }),
      ],
      NOW,
    );

    expect(summary.todo[0].action).toEqual({
      kind: "open",
      href: "/forms/open-form",
    });
    expect(summary.todo[1].action).toEqual({ kind: "not_yet_open" });
    expect(summary.todo[2].action).toEqual({ kind: "closed" });
  });

  it("returns gauge total zero when there are no required forms", () => {
    const { gauge } = summarizeFormProgress(
      [
        progressRow({
          required: false,
          submission: {
            id: "sub",
            submittedAt: new Date("2027-03-01T00:00:00Z"),
            updatedAt: null,
            reviewStatus: SubmissionReviewStatus.Pending,
          },
        }),
      ],
      NOW,
    );

    expect(gauge).toEqual({ done: 0, total: 0 });
  });

  it("sets canEdit on completed rows from availability and review status", () => {
    const { completed } = summarizeFormProgress(
      [
        progressRow({
          submission: {
            id: "pending",
            submittedAt: new Date("2027-03-01T00:00:00Z"),
            updatedAt: null,
            reviewStatus: SubmissionReviewStatus.Pending,
          },
          form: { availability: "open" },
        }),
        progressRow({
          form: {
            id: "66666666-6666-4666-8666-666666666666",
            formId: "reviewed",
            title: "Reviewed",
            availability: "open",
          },
          submission: {
            id: "under-review",
            submittedAt: new Date("2027-03-01T00:00:00Z"),
            updatedAt: null,
            reviewStatus: SubmissionReviewStatus.UnderReview,
          },
        }),
      ],
      NOW,
    );

    expect(completed[0].canEdit).toBe(true);
    expect(completed[1].canEdit).toBe(false);
  });
});
