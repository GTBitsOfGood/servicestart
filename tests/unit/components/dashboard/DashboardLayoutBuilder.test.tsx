// @vitest-environment happy-dom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardLayoutBuilder from "@/components/dashboard/DashboardLayoutBuilder";
import type { DashboardLayout, WidgetId } from "@/lib/dashboard/schema";

vi.mock("@/components/bog/BogIcon/BogIcon", () => ({
  default: ({ name }: { name: string }) => (
    <span data-testid={`icon-${name}`} />
  ),
}));

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useDraggable: () => ({
    ref: vi.fn(),
    isDragSource: false,
    isDragging: false,
    handleRef: vi.fn(),
  }),
  useDroppable: () => ({
    ref: vi.fn(),
    isDropTarget: false,
  }),
}));

const AVAILABLE_WIDGETS: { id: WidgetId; label: string }[] = [
  { id: "events", label: "Events" },
  { id: "notifications", label: "Notifications" },
  { id: "member_requests", label: "New Member Requests" },
  { id: "newsletter", label: "Newsletter" },
];

const DEFAULT_LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [
    { id: "events", size: "tall" },
    { id: "notifications", size: "tall" },
  ],
};

const EMPTY_LAYOUT: DashboardLayout = {
  layout: "horizontal",
  widgets: [],
};

function renderBuilder(
  overrides: Partial<{
    availableWidgets: typeof AVAILABLE_WIDGETS;
    initialLayout: DashboardLayout;
    onSave: (layout: DashboardLayout) => Promise<void>;
  }> = {},
) {
  const props = {
    availableWidgets: overrides.availableWidgets ?? AVAILABLE_WIDGETS,
    initialLayout: overrides.initialLayout ?? DEFAULT_LAYOUT,
    onSave: overrides.onSave ?? vi.fn(),
  };
  return render(<DashboardLayoutBuilder {...props} />);
}

describe("DashboardLayoutBuilder", () => {
  afterEach(cleanup);

  it("renders the heading and description", () => {
    renderBuilder();
    expect(screen.getByText("Customize Dashboard")).toBeTruthy();
    expect(screen.getByText(/Select up to 4 widgets/)).toBeTruthy();
  });

  it("renders all available widget cards", () => {
    renderBuilder();
    expect(screen.getByText("Events")).toBeTruthy();
    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("New Member Requests")).toBeTruthy();
    expect(screen.getByText("Newsletter")).toBeTruthy();
  });

  it("shows selected widgets in the preview", () => {
    renderBuilder();
    expect(screen.getByText("[events widget here]")).toBeTruthy();
    expect(screen.getByText("[notifications widget here]")).toBeTruthy();
  });

  it("shows empty state when no widgets are selected", () => {
    renderBuilder({ initialLayout: EMPTY_LAYOUT });
    expect(
      screen.getByText("Select widgets to preview your dashboard"),
    ).toBeTruthy();
  });

  it("toggles widget selection on click", () => {
    renderBuilder({ initialLayout: EMPTY_LAYOUT });

    const eventsCard = screen.getByRole("button", { name: "Events" });
    fireEvent.click(eventsCard);

    expect(screen.getByText("[events widget here]")).toBeTruthy();
  });

  it("deselects widget on second click", () => {
    renderBuilder({
      initialLayout: {
        layout: "horizontal",
        widgets: [{ id: "events", size: "tall" }],
      },
    });

    expect(screen.getByText("[events widget here]")).toBeTruthy();

    const eventsCards = screen.getAllByText("Events");
    const eventsButton = eventsCards
      .map((el) => el.closest("button"))
      .find((btn) => btn && !btn.textContent?.includes("widget here"));
    if (eventsButton) fireEvent.click(eventsButton);

    expect(screen.queryByText("[events widget here]")).toBeNull();
  });

  it("shows save button after changes", () => {
    renderBuilder({ initialLayout: EMPTY_LAYOUT });

    expect(screen.getByText("Save Layout")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save Layout/i })).toBeDisabled();

    const eventsCard = screen.getByRole("button", { name: "Events" });
    fireEvent.click(eventsCard);

    expect(
      screen.getByRole("button", { name: /Save Layout/i }),
    ).not.toBeDisabled();
  });

  it("calls onSave with correct layout when save is clicked", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderBuilder({ initialLayout: EMPTY_LAYOUT, onSave });

    const eventsCard = screen.getByRole("button", { name: "Events" });
    fireEvent.click(eventsCard);

    const saveButton = screen.getByText("Save Layout");
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: "horizontal",
        widgets: expect.arrayContaining([
          expect.objectContaining({ id: "events" }),
        ]),
      }),
    );
  });

  it("renders the settings gear icon", () => {
    renderBuilder();
    expect(screen.getByTestId("icon-gear")).toBeTruthy();
  });

  it("renders dashboard preview label", () => {
    renderBuilder();
    expect(screen.getByText("Dashboard preview")).toBeTruthy();
  });
});
