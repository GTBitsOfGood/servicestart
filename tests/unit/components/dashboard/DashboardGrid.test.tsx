import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The widgets are server components that load data; the grid only places them.
vi.mock("@/components/dashboard/widgets/NotificationsWidget", () => ({
  default: () => null,
}));

import DashboardGrid from "@/components/dashboard/DashboardGrid";
import type { DashboardLayout } from "@/lib/dashboard/schema";

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
        audience: "applicant",
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
      audience: "applicant",
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
});
