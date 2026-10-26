// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getRequiredFormStatus, splitSections } from "@/lib/forms/review";
import { FormComponentType, SubmissionReviewStatus } from "@/lib/schema";

describe("splitSections", () => {
  it("starts a section at each header", () => {
    const header = { id: "h1", type: FormComponentType.SectionHeader };
    const name = { id: "q1", type: FormComponentType.ShortText };
    const header2 = { id: "h2", type: FormComponentType.SectionHeader };
    const email = { id: "q2", type: FormComponentType.Email };

    expect(splitSections([header, name, header2, email])).toEqual([
      [header, name],
      [header2, email],
    ]);
  });

  it("groups questions before the first header", () => {
    const name = { id: "q1", type: FormComponentType.ShortText };
    const header = { id: "h1", type: FormComponentType.SectionHeader };

    expect(splitSections([name, header])).toEqual([[name], [header]]);
    expect(splitSections([])).toEqual([]);
  });
});

describe("getRequiredFormStatus", () => {
  const now = new Date("2027-05-10T00:00:00.000Z");
  const submission = {
    id: "s1",
    submittedAt: now,
    updatedAt: null,
    reviewStatus: SubmissionReviewStatus.Pending,
  };

  it("is completed once submitted, even past the due date", () => {
    expect(
      getRequiredFormStatus(
        { form: { dueAt: "2027-05-01T00:00:00.000Z" }, submission },
        now,
      ),
    ).toBe("completed");
  });

  it("is past due once the due date has passed", () => {
    expect(
      getRequiredFormStatus(
        { form: { dueAt: "2027-05-01T00:00:00.000Z" }, submission: null },
        now,
      ),
    ).toBe("past-due");
  });

  it("is not submitted before the due date or without one", () => {
    for (const dueAt of ["2027-06-01T00:00:00.000Z", null]) {
      expect(
        getRequiredFormStatus({ form: { dueAt }, submission: null }, now),
      ).toBe("not-submitted");
    }
  });
});
