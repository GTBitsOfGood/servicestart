import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormCompletedCard } from "@/lib/dashboard/formProgress";
import FormsCompletedWidget, {
  FormsCompletedWidgetView,
} from "@/components/dashboard/widgets/FormsCompletedWidget";

const { mockLoadFormProgress } = vi.hoisted(() => ({
  mockLoadFormProgress: vi.fn(),
}));

vi.mock("@/lib/dashboard/formProgress", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/dashboard/formProgress")>();
  return {
    ...actual,
    loadFormProgress: mockLoadFormProgress,
  };
});

function completedCard(
  overrides: Partial<FormCompletedCard> = {},
): FormCompletedCard {
  return {
    formUuid: "11111111-1111-4111-8111-111111111111",
    formId: "emergency-contact",
    title: "Emergency Contact",
    submittedAt: new Date("2027-03-01T00:00:00.000Z"),
    closesAt: "2027-06-01T00:00:00.000Z",
    canEdit: true,
    ...overrides,
  };
}

const widgetProps = {
  organizationId: "org-a",
  userId: "user-a",
  audience: "attendee" as const,
};

beforeEach(() => {
  mockLoadFormProgress.mockResolvedValue({
    formsEnabled: true,
    summary: {
      todo: [],
      completed: [completedCard()],
      gauge: { done: 1, total: 1 },
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormsCompletedWidgetView", () => {
  it("shows empty copy when there are no completed forms", () => {
    render(<FormsCompletedWidgetView cards={[]} />);

    expect(screen.getByText("Submitted forms will appear here.")).toBeTruthy();
  });

  it("lists a submitted form with view and edit links when editing is allowed", () => {
    render(<FormsCompletedWidgetView cards={[completedCard()]} />);

    expect(screen.getByText("Emergency Contact")).toBeTruthy();
    expect(screen.getByText(/Submitted/i)).toBeTruthy();
    expect(screen.getByText(/Open until/i)).toBeTruthy();

    expect(
      screen
        .getByRole("link", { name: "View Emergency Contact response" })
        .getAttribute("href"),
    ).toBe("/forms/emergency-contact/response");
    expect(
      screen
        .getByRole("link", { name: "Edit Emergency Contact response" })
        .getAttribute("href"),
    ).toBe("/forms/emergency-contact/edit");
  });

  it("always shows the view link and hides the edit link when canEdit is false", () => {
    render(
      <FormsCompletedWidgetView
        cards={[
          completedCard({
            title: "Consent",
            formId: "consent",
            canEdit: false,
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "View Consent response" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: "Edit Consent response" }),
    ).toBeNull();
  });

  it("omits open-until copy when the form has no closesAt", () => {
    render(
      <FormsCompletedWidgetView cards={[completedCard({ closesAt: null })]} />,
    );

    expect(screen.queryByText(/Open until/i)).toBeNull();
  });
});

describe("FormsCompletedWidget", () => {
  it("renders nothing when forms are disabled for the organization", async () => {
    mockLoadFormProgress.mockResolvedValue({ formsEnabled: false });

    const ui = await FormsCompletedWidget(widgetProps);
    const { container } = render(ui);

    expect(container.firstChild).toBeNull();
  });

  it("loads progress for the widget audience and renders completed rows", async () => {
    const ui = await FormsCompletedWidget(widgetProps);
    render(ui);

    expect(mockLoadFormProgress).toHaveBeenCalledWith(
      "org-a",
      "user-a",
      "attendee",
    );
    expect(screen.getByText("Emergency Contact")).toBeTruthy();
  });
});
