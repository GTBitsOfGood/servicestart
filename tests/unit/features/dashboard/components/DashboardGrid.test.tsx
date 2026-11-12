import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The widgets are server components that load data; the grid only places them.
vi.mock("@/features/communications/widgets/NotificationsWidget", () => ({
  default: () => null,
}));

import DashboardGrid from "@/features/dashboard/components/DashboardGrid";
import type { DashboardLayout } from "@/features/dashboard/lib/schema";
import { MemberTypeKeySchema } from "@/features/membership/lib/memberTypeKey";

type Props = Record<string, unknown> & { children?: ReactNode };

/** Every element in a rendered tree, without rendering its components. */
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

const statusConfig = {
  formId: "camp-application-2027",
  steps: [
    { label: "Submitted", description: "" },
    { label: "Interview", description: "" },
    { label: "Decision", description: "" },
  ],
};

describe("DashboardGrid", () => {
  it("renders each widget with its ID, the viewer, and its settings", () => {
    const layout: DashboardLayout = {
      layout: "horizontal",
      widgets: [
        { id: "application_status", size: "tall", config: statusConfig },
        { id: "notifications", size: "small" },
      ],
    };

    const tree = elements(
      DashboardGrid({
        layout,
        organizationId: "org_1",
        userId: "user_1",
        audience: MemberTypeKeySchema.parse("applicant"),
      }),
    );

    const slots = tree.filter((element) => element.props["data-widget-id"]);
    expect(slots.map((slot) => slot.props["data-widget-id"])).toEqual([
      "application_status",
      "notifications",
    ]);
    const widgets = slots.map((slot) =>
      elements(slot.props.children).find(
        (element) => "organizationId" in element.props,
      ),
    );
    expect(widgets[0]?.props).toEqual({
      organizationId: "org_1",
      userId: "user_1",
      audience: MemberTypeKeySchema.parse("applicant"),
      config: statusConfig,
    });
    expect(widgets[1]?.props.config).toBeUndefined();
  });

  it("says when there are no widgets", () => {
    const tree = elements(
      DashboardGrid({
        layout: { layout: "horizontal", widgets: [] },
        organizationId: "org_1",
        userId: "user_1",
        audience: "member",
      }),
    );
    expect(tree[0].props.children).toBe("No widgets configured");
  });

  it("lets the grid grow and gives the weekly calendar enough room", () => {
    const tree = elements(
      DashboardGrid({
        layout: {
          layout: "horizontal",
          widgets: [
            { id: "forms_todo", size: "small" },
            { id: "weekly_calendar", size: "small" },
          ],
        },
        organizationId: "org_1",
        userId: "user_1",
        audience: MemberTypeKeySchema.parse("attendee"),
      }),
    );

    expect(tree[0].props.className).toContain("mobile:min-h-dashboard-grid");
    expect(tree[0].props.className).not.toContain("mobile:h-dashboard-grid");
    const calendarSlot = tree.find(
      (element) => element.props["data-widget-id"] === "weekly_calendar",
    );
    expect(calendarSlot?.props.className).toContain("min-h-weekly-calendar");
  });
});
