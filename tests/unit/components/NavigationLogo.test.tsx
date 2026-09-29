import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SunsetLogo } from "@/components/navigation/Logo";

const branding = vi.hoisted(() => ({ logo_url: null as string | null }));
vi.mock("@/lib/hooks/useOrganizationConfig", () => ({
  default: () => branding,
}));

afterEach(cleanup);

describe("Navigation logo", () => {
  it("renders a configured logo using the shared URL normalization", () => {
    branding.logo_url = " /bog.svg ";
    render(<SunsetLogo />);
    expect(
      screen
        .getByRole("img", { name: "Organization logo" })
        .getAttribute("src"),
    ).toBe("/bog.svg");
    expect(screen.queryByRole("img", { name: "bits of good" })).toBeNull();
  });

  it.each([null, "   "])(
    "keeps the existing default logo lockup for %s",
    (logoUrl) => {
      branding.logo_url = logoUrl;
      render(<SunsetLogo />);
      expect(
        screen.getByRole("img", { name: "Logo" }).getAttribute("src"),
      ).toBe("/logo.svg");
      expect(screen.getByRole("img", { name: "bits of good" })).toBeTruthy();
      expect(screen.getByRole("img", { name: "sunset" })).toBeTruthy();
    },
  );
});
