import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FormsProgressWidget, {
  FormsProgressView,
} from "@/components/dashboard/widgets/FormsProgressWidget";
import type { WidgetProps } from "@/lib/dashboard/widgets";

const { mockLoadFormProgress } = vi.hoisted(() => ({
  mockLoadFormProgress: vi.fn(),
}));

vi.mock("@/lib/dashboard/formProgress", () => ({
  loadFormProgress: mockLoadFormProgress,
}));

const widgetProps: WidgetProps = {
  organizationId: "org-1",
  userId: "user-1",
  audience: "attendee",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FormsProgressView", () => {
  it("shows X/Y Forms Completed with an accessible gauge label", () => {
    render(<FormsProgressView gauge={{ done: 2, total: 4 }} />);

    expect(screen.getByText("2/4")).toBeTruthy();
    expect(screen.getByText("Forms Completed")).toBeTruthy();

    const gauge = screen.getByRole("img", {
      name: "2 of 4 forms completed",
    });
    expect(gauge).toBeTruthy();
  });

  it("shows zero progress when none are completed but required forms exist", () => {
    render(<FormsProgressView gauge={{ done: 0, total: 4 }} />);

    expect(screen.getByText("0/4")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "0 of 4 forms completed" }),
    ).toBeTruthy();
    expect(screen.queryByText("No required forms yet")).toBeNull();
  });

  it('shows "No required forms yet" when total is zero', () => {
    render(<FormsProgressView gauge={{ done: 0, total: 0 }} />);

    expect(screen.getByText("No required forms yet")).toBeTruthy();
    expect(screen.queryByText("0/0")).toBeNull();
    expect(screen.queryByText("Forms Completed")).toBeNull();
    expect(
      screen.getByRole("img", { name: "No required forms yet" }),
    ).toBeTruthy();
  });

  it("shows full completion", () => {
    render(<FormsProgressView gauge={{ done: 4, total: 4 }} />);

    expect(screen.getByText("4/4")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "4 of 4 forms completed" }),
    ).toBeTruthy();
  });
});

describe("FormsProgressWidget", () => {
  it("renders nothing when FormsEnabled is off", async () => {
    mockLoadFormProgress.mockResolvedValue({ formsEnabled: false });

    const result = await FormsProgressWidget(widgetProps);

    expect(result).toBeNull();
    expect(mockLoadFormProgress).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      "attendee",
    );
  });

  it("renders the gauge from the cached loader summary", async () => {
    mockLoadFormProgress.mockResolvedValue({
      formsEnabled: true,
      summary: {
        todo: [],
        completed: [],
        gauge: { done: 1, total: 4 },
      },
    });

    const ui = await FormsProgressWidget(widgetProps);
    render(ui);

    expect(screen.getByText("1/4")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "1 of 4 forms completed" }),
    ).toBeTruthy();
  });
});
