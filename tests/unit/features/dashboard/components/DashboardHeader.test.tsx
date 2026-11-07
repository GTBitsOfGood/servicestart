import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDashboardHeader: vi.fn(),
}));

vi.mock("@/core/config/OrganizationConfigService", () => ({
  OrganizationConfigService: {
    getDashboardHeader: mocks.getDashboardHeader,
  },
}));

vi.mock("@/features/communications/components/DashboardAlertBanner", () => ({
  default: () => null,
}));

import DashboardHeader from "@/features/dashboard/components/DashboardHeader";

const baseProps = {
  organizationId: "org_1",
  audience: "attendee" as const,
  user: { id: "user_1", name: "Tiffany Pham" },
};

describe("DashboardHeader", () => {
  beforeEach(() => {
    mocks.getDashboardHeader.mockReset();
  });

  it("renders all configured header fields for the viewer's audience", async () => {
    mocks.getDashboardHeader.mockResolvedValue({
      attendee: {
        title: "Hello, {firstName}!",
        subtitle: "Ready for camp?",
        location: "456 Peachtree Avenue, Atlanta, GA 30332",
        dates: "June 2 – Aug 20",
        schedule: "Mon & Wed | 10 AM – 5 PM",
        description: "A summer of workshops and mentorship.",
      },
    });

    render(await DashboardHeader(baseProps));

    expect(mocks.getDashboardHeader).toHaveBeenCalledWith("org_1");
    expect(
      screen.getByRole("heading", { level: 1, name: "Hello, Tiffany!" }),
    ).toBeTruthy();
    expect(screen.getByText("Ready for camp?")).toBeTruthy();
    expect(
      screen.getByText("456 Peachtree Avenue, Atlanta, GA 30332"),
    ).toBeTruthy();
    expect(
      screen.getByText("June 2 – Aug 20 | Mon & Wed | 10 AM – 5 PM"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Camp Description: A summer of workshops and mentorship.",
      ),
    ).toBeTruthy();
  });

  it("omits optional sections that are not configured", async () => {
    mocks.getDashboardHeader.mockResolvedValue({
      attendee: { title: "Camp Dashboard" },
    });

    const { container } = render(await DashboardHeader(baseProps));

    expect(
      screen.getByRole("heading", { level: 1, name: "Camp Dashboard" }),
    ).toBeTruthy();
    expect(container.querySelector("dl")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("keeps the built-in heading when the organization has no config", async () => {
    mocks.getDashboardHeader.mockResolvedValue({});

    const { container } = render(
      await DashboardHeader({
        ...baseProps,
        audience: "admin",
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Admin Dashboard" }),
    ).toBeTruthy();
    expect(container.querySelector("header")?.className).toContain("mb-4");
    expect(container.querySelector("header")?.className).toContain(
      "desktop:mb-8",
    );
  });
});
