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
import { OrganizationConfigKey } from "@/core/config/schema";
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

const initialHeader = {
  [volunteer]: { title: "Hello, {firstName}!" },
  [staff]: { title: "Staff dashboard" },
};

const initialFooter = {
  email: "hello@camp.org",
  ein: "84-4516921",
  socialLinks: [
    { platform: "instagram" as const, url: "https://instagram.com/camp" },
  ],
};

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

  it("edits audience content and saves the header and footer configs", async () => {
    render(
      <DashboardContentSettings
        initialHeader={initialHeader}
        initialFooter={initialFooter}
        memberTypesEnabled
        memberTypes={memberTypes}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Staff" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Updated staff dashboard" },
    });

    expect(screen.getByTestId("save-banner").textContent).toBe("unsaved");
    fireEvent.click(
      screen.getByRole("button", { name: "Save dashboard content" }),
    );

    await waitFor(() => expect(mocks.putConfig).toHaveBeenCalledTimes(2));
    const requests = mocks.putConfig.mock.calls.map(
      ([request]) => request.json,
    );
    expect(requests).toContainEqual({
      key: OrganizationConfigKey.DashboardHeader,
      value: JSON.stringify({
        [volunteer]: { title: "Hello, {firstName}!" },
        [staff]: { title: "Updated staff dashboard" },
      }),
    });
    expect(requests).toContainEqual({
      key: OrganizationConfigKey.OrganizationFooter,
      value: JSON.stringify(initialFooter),
    });
    await waitFor(() =>
      expect(screen.getByTestId("save-banner").textContent).toBe("success"),
    );
  });

  it("shows schema validation errors inline before saving", async () => {
    render(
      <DashboardContentSettings
        initialHeader={initialHeader}
        initialFooter={initialFooter}
        memberTypesEnabled
        memberTypes={memberTypes}
      />,
    );

    fireEvent.change(screen.getByLabelText("Contact email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save dashboard content" }),
    );

    expect(await screen.findByText("Enter a valid email address")).toBeTruthy();
    expect(mocks.putConfig).not.toHaveBeenCalled();
  });

  it("preserves additional links for a social platform when saving", async () => {
    const footerWithAdditionalLink = {
      ...initialFooter,
      socialLinks: [
        ...initialFooter.socialLinks,
        {
          platform: "instagram" as const,
          url: "https://instagram.com/camp-volunteers",
        },
      ],
    };
    render(
      <DashboardContentSettings
        initialHeader={initialHeader}
        initialFooter={footerWithAdditionalLink}
        memberTypesEnabled
        memberTypes={memberTypes}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Updated member dashboard" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save dashboard content" }),
    );

    await waitFor(() => expect(mocks.putConfig).toHaveBeenCalledTimes(2));
    expect(mocks.putConfig).toHaveBeenCalledWith({
      json: {
        key: OrganizationConfigKey.OrganizationFooter,
        value: JSON.stringify(footerWithAdditionalLink),
      },
    });
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

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Everyone, welcome" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save dashboard content" }),
    );

    await waitFor(() => {
      expect(mocks.putConfig).toHaveBeenCalledWith({
        json: {
          key: OrganizationConfigKey.DashboardHeader,
          value: JSON.stringify({
            member: { title: "Everyone, welcome" },
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
