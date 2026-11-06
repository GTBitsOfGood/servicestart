// @vitest-environment happy-dom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardLayoutBuilder from "@/features/dashboard/components/DashboardLayoutBuilder";
import {
  DEFAULT_APPLICATION_STATUS_STEPS,
  type DashboardLayout,
  type WidgetId,
} from "@/features/dashboard/lib/schema";

type DragEndEvent = {
  operation: { source: { id: string }; target: { id: string } };
};
const dragHandlers = vi.hoisted(() => ({
  onDragEnd: undefined as ((event: DragEndEvent) => void) | undefined,
}));

vi.mock("@/components/bog/BogIcon/BogIcon", () => ({
  default: ({ name }: { name: string }) => (
    <span data-testid={`icon-${name}`} />
  ),
}));

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: DragEndEvent) => void;
  }) => {
    dragHandlers.onDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
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
    forms: { formId: string; title: string }[];
  }> = {},
) {
  const props = {
    availableWidgets: overrides.availableWidgets ?? AVAILABLE_WIDGETS,
    initialLayout: overrides.initialLayout ?? DEFAULT_LAYOUT,
    onSave: overrides.onSave ?? vi.fn(),
    forms: overrides.forms,
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

    const saveButton = screen.getByRole("button", { name: /Save Layout/i });
    expect(saveButton).toBeTruthy();
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    const eventsCard = screen.getByRole("button", { name: "Events" });
    fireEvent.click(eventsCard);

    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
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

  it("preserves widget settings when saving a changed layout", () => {
    const config = {
      formId: "camp-application",
      steps: [
        { label: "Submitted", description: "Received" },
        { label: "Review", description: "In review" },
        { label: "Decision", description: "Decided" },
      ],
    };
    let saved: DashboardLayout | undefined;
    renderBuilder({
      availableWidgets: [
        ...AVAILABLE_WIDGETS,
        { id: "application_status", label: "Application status" },
      ],
      initialLayout: {
        layout: "horizontal",
        widgets: [
          { id: "application_status", size: "tall", config },
          { id: "events", size: "tall" },
        ],
      },
      onSave: async (layout) => {
        saved = layout;
      },
    });
    act(() =>
      dragHandlers.onDragEnd!({
        operation: {
          source: { id: "application_status" },
          target: { id: "events__mid" },
        },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Layout" }));
    expect(
      saved?.widgets.find((widget) => widget.id === "application_status")
        ?.config,
    ).toEqual(config);
    expect(saved?.widgets.map(({ id }) => id)).toEqual([
      "events",
      "application_status",
    ]);
  });

  it("renders dashboard preview label", () => {
    renderBuilder();
    expect(screen.getByText("Dashboard preview")).toBeTruthy();
  });

  describe("application status settings", () => {
    const WIDGETS = [
      ...AVAILABLE_WIDGETS,
      { id: "application_status" as const, label: "Application Status" },
    ];
    const FORMS = [
      { formId: "camp-application", title: "Camp Application" },
      { formId: "volunteer", title: "Volunteer Form" },
    ];
    const settingsPanel = () =>
      screen.queryByRole("region", { name: "Application Status settings" });
    const save = () => screen.getByRole("button", { name: "Save Layout" });

    it("shows only with forms and with the widget selected", () => {
      renderBuilder({
        availableWidgets: WIDGETS,
        initialLayout: EMPTY_LAYOUT,
        forms: FORMS,
      });
      expect(settingsPanel()).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Application Status" }),
      );
      expect(settingsPanel()).toBeTruthy();
      // Prefilled from the default steps.
      expect(screen.getAllByLabelText("Label")).toHaveLength(3);
      expect(
        (screen.getAllByLabelText("Label")[0] as HTMLInputElement).value,
      ).toBe("Submitted");
    });

    it("is absent without forms, as on the admin dashboard page", () => {
      renderBuilder({
        availableWidgets: WIDGETS,
        initialLayout: {
          layout: "horizontal",
          widgets: [{ id: "application_status", size: "tall" }],
        },
      });
      expect(settingsPanel()).toBeNull();
      expect(screen.queryByLabelText("Application form")).toBeNull();
    });

    it("saves the chosen form and edited steps as the widget's config", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderBuilder({
        availableWidgets: WIDGETS,
        initialLayout: EMPTY_LAYOUT,
        forms: FORMS,
        onSave,
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Application Status" }),
      );
      fireEvent.change(screen.getByLabelText("Application form"), {
        target: { value: "volunteer" },
      });
      fireEvent.change(screen.getAllByLabelText("Label")[1], {
        target: { value: "Interview" },
      });
      await act(async () => fireEvent.click(save()));
      expect(onSave).toHaveBeenCalledWith({
        layout: "horizontal",
        widgets: [
          {
            id: "application_status",
            size: "tall",
            config: {
              formId: "volunteer",
              steps: [
                DEFAULT_APPLICATION_STATUS_STEPS[0],
                { ...DEFAULT_APPLICATION_STATUS_STEPS[1], label: "Interview" },
                DEFAULT_APPLICATION_STATUS_STEPS[2],
              ],
            },
          },
        ],
      });
    });

    it("saves the widget without config when no form is chosen", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderBuilder({
        availableWidgets: WIDGETS,
        initialLayout: EMPTY_LAYOUT,
        forms: FORMS,
        onSave,
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Application Status" }),
      );
      await act(async () => fireEvent.click(save()));
      expect(onSave.mock.calls[0][0].widgets).toEqual([
        { id: "application_status", size: "tall" },
      ]);
    });

    it("blocks saving an empty step label and says why", () => {
      const onSave = vi.fn();
      renderBuilder({
        availableWidgets: WIDGETS,
        initialLayout: {
          layout: "horizontal",
          widgets: [
            {
              id: "application_status",
              size: "tall",
              config: {
                formId: "camp-application",
                steps: DEFAULT_APPLICATION_STATUS_STEPS,
              },
            },
          ],
        },
        forms: FORMS,
        onSave,
      });
      expect(
        (screen.getByLabelText("Application form") as HTMLSelectElement).value,
      ).toBe("camp-application");
      fireEvent.change(screen.getAllByLabelText("Label")[2], {
        target: { value: "  " },
      });
      expect(screen.getByRole("alert").textContent).toBe(
        "Give the step a name",
      );
      // Under, and tied to, the field it's about.
      const label3 = screen.getAllByLabelText("Label")[2];
      expect(label3.getAttribute("aria-invalid")).toBe("true");
      expect(label3.getAttribute("aria-describedby")).toBe(
        screen.getByRole("alert").id,
      );
      expect(
        screen.getAllByLabelText("Label")[0].getAttribute("aria-invalid"),
      ).toBeNull();
      expect((save() as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(save());
      expect(onSave).not.toHaveBeenCalled();
    });

    it("drops the settings when the widget is deselected, and discard restores them", async () => {
      const config = {
        formId: "camp-application",
        steps: DEFAULT_APPLICATION_STATUS_STEPS,
      };
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderBuilder({
        availableWidgets: WIDGETS,
        initialLayout: {
          layout: "horizontal",
          widgets: [{ id: "application_status", size: "tall", config }],
        },
        forms: FORMS,
        onSave,
      });
      const card = () =>
        screen.getByRole("button", { name: "Application Status" });
      fireEvent.click(card());
      fireEvent.click(card());
      expect(
        (screen.getByLabelText("Application form") as HTMLSelectElement).value,
      ).toBe("");

      fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
      expect(
        (screen.getByLabelText("Application form") as HTMLSelectElement).value,
      ).toBe("camp-application");
    });
  });
});
