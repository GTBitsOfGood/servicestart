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
import { MemberType, OrganizationConfigKey } from "@/lib/schema";

const mocks = vi.hoisted(() => ({
  putConfig: vi.fn(),
  postAlert: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
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

import DashboardContentSettings from "@/components/dashboard/DashboardContentSettings";

const initialHeader = {
  applicant: { title: "Hello, {firstName}!" },
  attendee: { title: "My Camp Dashboard" },
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
      json: async () => ({ sent: 3 }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("edits audience content and saves the header and footer configs", async () => {
    render(
      <DashboardContentSettings
        initialHeader={initialHeader}
        initialFooter={initialFooter}
        memberTypesEnabled
      />,
    );

    expect(screen.getByRole("tab", { name: "Applicants" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Current Attendees" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Updated Camp Dashboard" },
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
        applicant: { title: "Hello, {firstName}!" },
        attendee: { title: "Updated Camp Dashboard" },
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

  it("posts an alert to selected member types", async () => {
    render(
      <DashboardContentSettings
        initialHeader={initialHeader}
        initialFooter={initialFooter}
        memberTypesEnabled
      />,
    );

    fireEvent.change(screen.getByLabelText("Alert title"), {
      target: { value: "Weather update" },
    });
    fireEvent.change(screen.getByLabelText("Alert message"), {
      target: { value: "Camp is closed Friday." },
    });
    fireEvent.click(screen.getByLabelText("Current attendees"));
    fireEvent.click(screen.getByRole("button", { name: "Post alert" }));

    await waitFor(() => {
      expect(mocks.postAlert).toHaveBeenCalledWith({
        json: {
          title: "Weather update",
          message: "Camp is closed Friday.",
          memberTypes: [MemberType.Attendee],
        },
      });
    });
    expect(
      await screen.findByText("Alert posted successfully to 3 members."),
    ).toBeTruthy();
  });

  it("uses one header and all-member alerts when member types are disabled", async () => {
    render(
      <DashboardContentSettings
        initialHeader={{ default: { title: "Community Dashboard" } }}
        initialFooter={{}}
        memberTypesEnabled={false}
      />,
    );

    expect(screen.getByRole("tab", { name: "All Members" })).toBeTruthy();
    expect(screen.queryByText("Recipients")).toBeNull();
    fireEvent.change(screen.getByLabelText("Alert title"), {
      target: { value: "Reminder" },
    });
    fireEvent.change(screen.getByLabelText("Alert message"), {
      target: { value: "Bring your ID." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post alert" }));

    await waitFor(() => {
      expect(mocks.postAlert).toHaveBeenCalledWith({
        json: { title: "Reminder", message: "Bring your ID." },
      });
    });
  });
});
