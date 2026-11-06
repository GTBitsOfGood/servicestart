// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ApplicationStatusWidget, {
  ApplicationStatusWidgetView,
} from "@/features/forms/widgets/ApplicationStatusWidget";
import {
  getApplicationStatusView,
  NO_APPLICATION_MESSAGE,
} from "@/features/forms/lib/applicationStatus";
import { DEFAULT_APPLICATION_STATUS_STEPS } from "@/features/dashboard/lib/schema";
import {
  FormStatus,
  MemberType,
  OrganizationConfigKey,
  SubmissionReviewStatus,
} from "@/lib/schema";
import type { MemberFormProgress } from "@/features/forms/services/FormProgressService";
import { OrganizationConfigService } from "@/core/config/OrganizationConfigService";
import { progressRow } from "@/tests/unit/fixtures/formProgress";
import {
  addMember,
  buildTestUser,
  createForm,
  createFormSubmission,
  createOrganization,
  signUpAndGetSession,
  VISIONARIES_APPLICATION_FORM,
} from "@/tests/unit/testUtils";

const CONFIG = { formId: "camp-app", steps: DEFAULT_APPLICATION_STATUS_STEPS };

afterEach(cleanup);

function renderView(
  rows: MemberFormProgress[],
  firstName: string | null = null,
  config: unknown = CONFIG,
) {
  return render(
    <ApplicationStatusWidgetView
      view={getApplicationStatusView(config, rows)}
      firstName={firstName}
    />,
  );
}

const app = (
  reviewStatus: SubmissionReviewStatus | null,
  opts: Parameters<typeof progressRow>[1] = {},
) => progressRow("camp-app", { reviewStatus, ...opts });

const timeline = () =>
  screen
    .getByRole("heading", { name: "Application timeline" })
    .parentElement!.querySelectorAll("ol > li");

/** The status chip (BogChip renders a Radix badge). */
const chip = () => document.querySelector(".rt-Badge");

/** Each step's screen-reader state, in order. */
const timelineStates = () =>
  [...timeline()].map(
    (li) => li.textContent?.match(/, (complete|current|not started)/)?.[1],
  );

describe("ApplicationStatusWidgetView", () => {
  it("not started: title, due date and Start application", () => {
    renderView([app(null, { dueAt: "2027-04-01T03:59:00.000Z" })]);
    expect(
      screen.getByRole("heading", { name: "Title camp-app" }),
    ).toBeTruthy();
    expect(screen.getByText(/^Due/).textContent).toMatch(/2027/);
    expect(
      screen
        .getByRole("link", { name: "Start application" })
        .getAttribute("href"),
    ).toBe("/forms/camp-app");
    expect(screen.queryByText("View Application")).toBeNull();
    expect(timelineStates()).toEqual([
      "not started",
      "not started",
      "not started",
    ]);
  });

  it("not yet open: when it opens, and no button", () => {
    renderView([app(null, { availability: "not_yet_open" })]);
    expect(screen.getByText(/^Opens/).textContent).toMatch(/2030|2029/);
    expect(
      screen.queryByRole("link", { name: "Start application" }),
    ).toBeNull();
  });

  it("pending: chip, review text, step 1 complete, View Application", () => {
    renderView([app(SubmissionReviewStatus.Pending)]);
    expect(chip()?.textContent).toBe("Pending");
    // Token colors, not BogChip's faint gold "amber".
    expect(chip()?.getAttribute("style")).toContain("status-amber-text");
    expect(
      screen.getByText(/currently being reviewed by our team/).textContent,
    ).toMatch(/Check back again later/);
    expect(
      screen
        .getByRole("link", { name: "View Application" })
        .getAttribute("href"),
    ).toBe("/forms/camp-app/response");
    expect(timelineStates()).toEqual([
      "complete",
      "not started",
      "not started",
    ]);
  });

  it("asks for required documents while any next step is open", () => {
    renderView([app(SubmissionReviewStatus.Pending), progressRow("medical")]);
    expect(
      screen.getByText(/currently being reviewed by our team/).textContent,
    ).toMatch(/Please complete any required documents/);
  });

  it("under review: step 2 current", () => {
    renderView([app(SubmissionReviewStatus.UnderReview)]);
    expect(chip()?.textContent).toBe("Under Review");
    expect(timelineStates()).toEqual(["complete", "current", "not started"]);
  });

  it("accepted: banner with first name and every step complete", () => {
    renderView([app(SubmissionReviewStatus.Accepted)], "Bob");
    expect(screen.getByRole("status").textContent).toMatch(
      /^Congratulations, Bob!You've been selected/,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Accepted")).toBeTruthy();
    expect(timelineStates()).toEqual(["complete", "complete", "complete"]);
  });

  it("accepted without a name: a plain congratulations", () => {
    renderView([app(SubmissionReviewStatus.Accepted)], null);
    expect(screen.getByText("Congratulations!")).toBeTruthy();
  });

  it("rejected: grey chip, kind message, neutral last step, no next steps", () => {
    const { container } = renderView([
      app(SubmissionReviewStatus.Rejected),
      progressRow("medical"),
    ]);
    expect(chip()?.textContent).toBe("Rejected");
    // BogChip's default grey: no color class at all.
    expect(chip()?.className).not.toMatch(/_(red|gray|amber|blue|green)_/);
    expect(container.innerHTML).not.toMatch(/-red-|_red_/);
    expect(screen.getByText(/Thank you for applying/)).toBeTruthy();
    expect(screen.queryByText("Your next steps")).toBeNull();
    expect(timelineStates()).toEqual(["complete", "complete", "complete"]);
    expect(timeline()[2].innerHTML).not.toMatch(/bg-brand-text/);
  });

  it.each([
    ["closed without a submission", [app(null, { availability: "closed" })]],
    ["no matching form", [progressRow("other")]],
  ])("%s: the neutral empty state", (_, rows) => {
    renderView(rows);
    expect(screen.getByText("Application Status")).toBeTruthy();
    expect(screen.queryByText("Start application")).toBeNull();
  });

  it.each([undefined, null, 42, { formId: "camp-app" }, { steps: [] }])(
    "never throws on config %j",
    (config) => {
      render(
        <ApplicationStatusWidgetView
          view={getApplicationStatusView(config, [
            app(SubmissionReviewStatus.Pending),
          ])}
        />,
      );
      expect(screen.getByText(NO_APPLICATION_MESSAGE)).toBeTruthy();
    },
  );

  describe("Your next steps", () => {
    it("counts completed items, fades them, and links the rest", () => {
      renderView([
        app(SubmissionReviewStatus.Pending),
        progressRow("medical", { dueAt: "2027-05-01T00:00:00.000Z" }),
        progressRow("waiver", { reviewStatus: SubmissionReviewStatus.Pending }),
        progressRow("later", { availability: "not_yet_open" }),
      ]);
      expect(screen.getByText("1 of 2 completed")).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: /^Open form\W+Title medical$/ })
          .getAttribute("href"),
      ).toBe("/forms/medical");
      expect(screen.getByText(/Complete this form by/)).toBeTruthy();
      const done = screen.getByText(/Title waiver/).closest("li")!;
      expect(done.className).toMatch(/opacity-50/);
      expect(within(done).queryByRole("link")).toBeNull();
      // The application itself and not-yet-open forms aren't next steps.
      expect(screen.queryByText("Title later")).toBeNull();
      expect(screen.queryByRole("link", { name: /Title camp-app/ })).toBeNull();
      expect(screen.queryByText("All caught up!")).toBeNull();
    });

    it("is all caught up with nothing to do, even with no items", () => {
      renderView([app(SubmissionReviewStatus.UnderReview)]);
      expect(screen.getByText("0 of 0 completed")).toBeTruthy();
      expect(screen.getByText("All caught up!")).toBeTruthy();
    });

    it("is all caught up once every item is submitted", () => {
      renderView([
        app(SubmissionReviewStatus.Pending),
        progressRow("waiver", { reviewStatus: SubmissionReviewStatus.Pending }),
      ]);
      expect(screen.getByText("1 of 1 completed")).toBeTruthy();
      expect(screen.getByText("All caught up!")).toBeTruthy();
    });
  });
});

describe("ApplicationStatusWidget (database)", () => {
  async function applicantOrg(name = "Bob Applicant") {
    const org = await createOrganization(
      `app-${Math.random().toString(36).slice(2, 10)}`,
    );
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "true",
    );
    const { user } = await signUpAndGetSession(
      { ...buildTestUser(), name },
      org.slug,
    );
    await addMember(user.id, org.id, "member", MemberType.Applicant);
    const form = await createForm(org.id, {
      formId: `camp-${org.slug}`,
      title: `Camp ${org.slug}`,
      status: FormStatus.Published,
      settings: VISIONARIES_APPLICATION_FORM.settings,
    });
    return { org, user, form };
  }

  async function renderWidget(
    organizationId: string,
    userId: string,
    config: unknown,
  ) {
    render(
      await ApplicationStatusWidget({
        organizationId,
        userId,
        audience: "applicant",
        config,
      }),
    );
  }

  it("shows the viewer's own application and status", async () => {
    const { org, user, form } = await applicantOrg();
    await createFormSubmission(form, {
      userId: user.id,
      reviewStatus: SubmissionReviewStatus.UnderReview,
    });
    await renderWidget(org.id, user.id, { ...CONFIG, formId: form.formId });
    expect(screen.getByRole("heading", { name: form.title })).toBeTruthy();
    expect(chip()?.textContent).toBe("Under Review");
  });

  it("greets an accepted applicant by first name", async () => {
    const { org, user, form } = await applicantOrg("Ada Lovelace");
    await createFormSubmission(form, {
      userId: user.id,
      reviewStatus: SubmissionReviewStatus.Accepted,
    });
    await renderWidget(org.id, user.id, { ...CONFIG, formId: form.formId });
    expect(screen.getByText("Congratulations, Ada!")).toBeTruthy();
  });

  it("never shows another org's application", async () => {
    const a = await applicantOrg();
    const b = await applicantOrg();
    await createFormSubmission(b.form, {
      userId: b.user.id,
      reviewStatus: SubmissionReviewStatus.Accepted,
    });
    // Org A's widget points at org B's published form, which B's applicant
    // has submitted. Inside org A, neither applicant sees any of it.
    for (const userId of [a.user.id, b.user.id]) {
      await renderWidget(a.org.id, userId, {
        ...CONFIG,
        formId: b.form.formId,
      });
      expect(screen.getByText(NO_APPLICATION_MESSAGE)).toBeTruthy();
      expect(screen.queryByText(b.form.title)).toBeNull();
      expect(screen.queryByText("Accepted")).toBeNull();
      cleanup();
    }
  });

  it("shows the empty state for a draft form", async () => {
    const { org, user } = await applicantOrg();
    const draft = await createForm(org.id, {
      status: FormStatus.Draft,
      settings: VISIONARIES_APPLICATION_FORM.settings,
    });
    await renderWidget(org.id, user.id, { ...CONFIG, formId: draft.formId });
    expect(screen.getByText(NO_APPLICATION_MESSAGE)).toBeTruthy();
    expect(screen.queryByText("Start application")).toBeNull();
  });

  it("shows the empty state while forms are off", async () => {
    const { org, user, form } = await applicantOrg();
    await OrganizationConfigService.setConfig(
      org.id,
      OrganizationConfigKey.FormsEnabled,
      "false",
    );
    await renderWidget(org.id, user.id, { ...CONFIG, formId: form.formId });
    expect(screen.getByText(NO_APPLICATION_MESSAGE)).toBeTruthy();
  });
});
