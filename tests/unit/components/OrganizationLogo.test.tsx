import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import OrganizationLogo from "@/components/OrganizationLogo";

afterEach(cleanup);

describe("OrganizationLogo", () => {
  it("renders the configured URL directly and preserves image proportions", () => {
    render(
      <OrganizationLogo
        logoUrl=" https://example.com/organization-logo.png "
        className="h-24 w-24"
      />,
    );

    const logo = screen.getByRole("img", { name: "Organization logo" });
    expect(logo.getAttribute("src")).toBe(
      "https://example.com/organization-logo.png",
    );
    expect(logo.classList.contains("object-contain")).toBe(true);
    expect(logo.classList.contains("h-24")).toBe(true);
  });

  it.each([undefined, null, "", "   "])(
    "renders the fallback for an unconfigured logo (%s)",
    (logoUrl) => {
      render(<OrganizationLogo logoUrl={logoUrl} />);
      expect(
        screen
          .getByRole("img", { name: "Organization logo" })
          .getAttribute("src"),
      ).toBe("/logo.svg");
    },
  );
});
