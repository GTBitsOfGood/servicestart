// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationConfigKey } from "@/lib/schema";

const mocks = vi.hoisted(() => ({
  getOrganizationFooter: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock("@/lib/services/OrganizationConfigService", () => ({
  OrganizationConfigService: {
    getOrganizationFooter: mocks.getOrganizationFooter,
    getConfig: mocks.getConfig,
  },
}));

import OrganizationFooter from "@/components/navigation/OrganizationFooter";

describe("OrganizationFooter", () => {
  beforeEach(() => {
    mocks.getOrganizationFooter.mockReset();
    mocks.getConfig.mockReset();
    mocks.getConfig.mockResolvedValue({
      [OrganizationConfigKey.LogoUrl]: "/organizations/camp-logo.png",
    });
  });

  afterEach(() => cleanup());

  it("renders the configured contact details, social links, and logo", async () => {
    mocks.getOrganizationFooter.mockResolvedValue({
      email: "hello@camp.org",
      phone: "(404) 555-0123",
      address: "456 Peachtree Avenue, Atlanta, GA 30332",
      ein: "84-4516921",
      socialLinks: [
        { platform: "instagram", url: "https://instagram.com/camp" },
        { platform: "website", url: "https://camp.org" },
      ],
    });

    const { container } = render(
      await OrganizationFooter({ organizationId: "org_camp" }),
    );

    expect(mocks.getOrganizationFooter).toHaveBeenCalledWith("org_camp");
    expect(mocks.getConfig).toHaveBeenCalledWith("org_camp", [
      OrganizationConfigKey.LogoUrl,
    ]);
    expect(screen.getByRole("link", { name: "hello@camp.org" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "(404) 555-0123" })).toBeTruthy();
    expect(
      screen.getByText("Address: 456 Peachtree Avenue, Atlanta, GA 30332"),
    ).toBeTruthy();
    expect(screen.getByText("EIN: 84-4516921")).toBeTruthy();

    const instagram = screen.getByRole("link", { name: "Instagram" });
    expect(instagram.getAttribute("href")).toBe("https://instagram.com/camp");
    expect(instagram.getAttribute("target")).toBe("_blank");
    expect(instagram.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: "Website" })).toBeTruthy();
    expect(
      screen
        .getByRole("img", { name: "Organization logo" })
        .getAttribute("src"),
    ).toBe("/organizations/camp-logo.png");
    expect(container.querySelector("footer")?.className).toContain(
      "border-grey-stroke-weak",
    );
    expect(container.querySelector("footer")?.className).toContain("w-full");
  });

  it("renders a partial footer without empty labels", async () => {
    mocks.getOrganizationFooter.mockResolvedValue({
      email: "hello@camp.org",
    });

    const { container } = render(
      await OrganizationFooter({ organizationId: "org_camp" }),
    );

    expect(container.textContent).toContain("Email:");
    expect(container.textContent).not.toContain("Phone:");
    expect(container.textContent).not.toContain("Address:");
    expect(container.textContent).not.toContain("EIN:");
  });

  it("renders nothing when the organization has no footer configuration", async () => {
    mocks.getOrganizationFooter.mockResolvedValue({});

    const { container } = render(
      await OrganizationFooter({ organizationId: "org_without_footer" }),
    );

    expect(container.innerHTML).toBe("");
  });
});
