// @vitest-environment jsdom
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberTypeKey } from "@/features/membership/lib/memberTypeKey";

const mocks = vi.hoisted(() => ({
  putConfig: vi.fn(),
  postAlert: vi.fn(),
}));

vi.mock("@/core/api/client", () => ({
  default: {
    organizationConfig: { $put: mocks.putConfig },
    alerts: { $post: mocks.postAlert },
  },
}));

vi.mock("@/components/SaveBanner", () => ({
  default: ({ status }: { status: string | null }) => (
    <div data-testid="save-banner">{status}</div>
  ),
}));

vi.mock("@/components/theme/ThemedButton", () => ({
  default: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

import DashboardContentSettings from "@/features/dashboard/components/DashboardContentSettings";

const volunteer = "volunteer" as MemberTypeKey;
const staff = "staff" as MemberTypeKey;

const memberTypes = [
  {
    key: volunteer,
    label: "Volunteer",
    pluralLabel: "Volunteers",
    position: 0,
    isSignupDefault: true,
  },
  {
    key: staff,
    label: "Staff",
    pluralLabel: "Staff",
    position: 1,
    isSignupDefault: false,
  },
];

describe("DashboardContentSettings", () => {
  beforeEach(() => {
    mocks.putConfig.mockResolvedValue({ ok: true });
    mocks.postAlert.mockResolvedValue({
      ok: true,
      json: async () => ({ sent: 1 }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders header tabs from memberTypes", () => {
    render(
      <DashboardContentSettings
        initialHeader={{}}
        initialFooter={{}}
        memberTypesEnabled
        memberTypes={memberTypes}
      />,
    );

    expect(screen.getByRole("tab", { name: "Members" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Volunteers" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Staff" })).toBeTruthy();
  });

  it("posts an alert to selected member types", async () => {
    render(
      <DashboardContentSettings
        initialHeader={{}}
        initialFooter={{}}
        memberTypesEnabled
        memberTypes={memberTypes}
      />,
    );

    fireEvent.change(screen.getByLabelText("Alert title"), {
      target: { value: "Weather update" },
    });
    fireEvent.change(screen.getByLabelText("Alert message"), {
      target: { value: "Camp is closed Friday." },
    });
    fireEvent.click(screen.getByLabelText("Staff"));
    fireEvent.click(screen.getByRole("button", { name: "Post alert" }));

    await waitFor(() => {
      expect(mocks.postAlert).toHaveBeenCalledWith({
        json: {
          title: "Weather update",
          message: "Camp is closed Friday.",
          memberTypes: [staff],
        },
      });
    });
  });

  it("keeps per-type header entries when member types are off", async () => {
    render(
      <DashboardContentSettings
        initialHeader={{
          member: { title: "Everyone" },
          [volunteer]: { title: "Volunteer home" },
        }}
        initialFooter={{}}
        memberTypesEnabled={false}
        memberTypes={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.putConfig).toHaveBeenCalledWith({
        json: {
          key: expect.any(String),
          value: JSON.stringify({
            member: { title: "Everyone" },
            [volunteer]: { title: "Volunteer home" },
          }),
        },
      });
    });
  });

  it("uses one header tab when member types are disabled", () => {
    render(
      <DashboardContentSettings
        initialHeader={{ member: { title: "Community Dashboard" } }}
        initialFooter={{}}
        memberTypesEnabled={false}
        memberTypes={[]}
      />,
    );

    expect(screen.getByRole("tab", { name: "All Members" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Volunteers" })).toBeNull();
  });
});
