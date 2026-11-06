// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  APPLICATIONS_CLOSED_MESSAGE,
  getApplicationStatusView,
  getFirstName,
  NO_APPLICATION_MESSAGE,
} from "@/features/forms/lib/applicationStatus";
import { DEFAULT_APPLICATION_STATUS_STEPS } from "@/features/dashboard/lib/schema";
import { SubmissionReviewStatus } from "@/lib/schema";
import { progressRow } from "@/tests/unit/fixtures/formProgress";

const CONFIG = { formId: "camp-app", steps: DEFAULT_APPLICATION_STATUS_STEPS };

const empty = (message: string) => ({ kind: "empty", message });

describe("getApplicationStatusView", () => {
  it.each([
    ["no config", undefined],
    ["a malformed config", { formId: 7, steps: "nope" }],
    ["too few steps", { formId: "camp-app", steps: [] }],
    ["a string", "camp-app"],
  ])("shows the empty state for %s", (_, config) => {
    expect(
      getApplicationStatusView(config, [
        progressRow("camp-app", {
          reviewStatus: SubmissionReviewStatus.Pending,
        }),
      ]),
    ).toEqual(empty(NO_APPLICATION_MESSAGE));
  });

  it("shows the empty state when the form isn't in the viewer's list", () => {
    expect(
      getApplicationStatusView(CONFIG, [progressRow("other-form")]),
    ).toEqual(empty(NO_APPLICATION_MESSAGE));
  });

  it("says applications are closed when they never submitted", () => {
    expect(
      getApplicationStatusView(CONFIG, [
        progressRow("camp-app", { availability: "closed" }),
      ]),
    ).toEqual(empty(APPLICATIONS_CLOSED_MESSAGE));
  });

  it("still shows a submitted application after the form closes", () => {
    const view = getApplicationStatusView(CONFIG, [
      progressRow("camp-app", {
        availability: "closed",
        reviewStatus: SubmissionReviewStatus.UnderReview,
      }),
    ]);
    expect(view).toMatchObject({
      kind: "application",
      status: SubmissionReviewStatus.UnderReview,
    });
  });

  it.each([
    [null, ["upcoming", "upcoming", "upcoming"], [false, false, false]],
    [
      SubmissionReviewStatus.Pending,
      ["complete", "upcoming", "upcoming"],
      [false, false, false],
    ],
    [
      SubmissionReviewStatus.UnderReview,
      ["complete", "current", "upcoming"],
      [false, false, false],
    ],
    [
      SubmissionReviewStatus.Accepted,
      ["complete", "complete", "complete"],
      [false, false, false],
    ],
    [
      SubmissionReviewStatus.Rejected,
      ["complete", "complete", "complete"],
      [false, false, true],
    ],
  ])("maps %s to the timeline", (reviewStatus, states, neutral) => {
    const view = getApplicationStatusView(CONFIG, [
      progressRow("camp-app", { reviewStatus }),
    ]);
    if (view.kind !== "application") throw new Error("expected application");
    expect(view.steps.map((step) => step.state)).toEqual(states);
    expect(view.steps.map((step) => step.neutral ?? false)).toEqual(neutral);
    expect(view.steps.map((step) => step.label)).toEqual(
      CONFIG.steps.map((step) => step.label),
    );
  });

  it("lists actionable required forms other than the application, to do first", () => {
    const view = getApplicationStatusView(CONFIG, [
      progressRow("camp-app", { reviewStatus: SubmissionReviewStatus.Pending }),
      progressRow("done", { reviewStatus: SubmissionReviewStatus.Pending }),
      progressRow("todo", { dueAt: "2027-01-01T00:00:00Z" }),
      progressRow("later", { availability: "not_yet_open" }),
      progressRow("missed", { availability: "closed" }),
      progressRow("closed-done", {
        availability: "closed",
        reviewStatus: SubmissionReviewStatus.Accepted,
      }),
      progressRow("optional", {
        required: false,
        reviewStatus: SubmissionReviewStatus.Pending,
      }),
    ]);
    if (view.kind !== "application") throw new Error("expected application");
    expect(view.nextSteps).toEqual([
      {
        formId: "todo",
        title: "Title todo",
        dueAt: "2027-01-01T00:00:00Z",
        done: false,
      },
      { formId: "done", title: "Title done", dueAt: null, done: true },
      {
        formId: "closed-done",
        title: "Title closed-done",
        dueAt: null,
        done: true,
      },
    ]);
  });

  it("hides next steps once rejected", () => {
    const view = getApplicationStatusView(CONFIG, [
      progressRow("camp-app", {
        reviewStatus: SubmissionReviewStatus.Rejected,
      }),
      progressRow("todo"),
    ]);
    expect(view).toMatchObject({ nextSteps: null });
  });
});

describe("getFirstName", () => {
  it.each([
    ["Bob Smith", "Bob"],
    ["  Ada  ", "Ada"],
    ["", null],
    ["   ", null],
    [null, null],
    [undefined, null],
  ])("reads %j as %j", (name, first) => {
    expect(getFirstName(name)).toBe(first);
  });
});
