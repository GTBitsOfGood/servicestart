// @vitest-environment happy-dom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";
import ForgotPasswordPage from "@/app/forgotpassword/page";
import ResetPasswordPage from "@/app/resetpassword/page";

const mockConfig = vi.fn();

vi.mock("@/lib/hooks/useOrganizationConfig", () => ({
  default: () => mockConfig(),
}));

vi.mock("@/lib/hooks/useActiveOrganization", () => ({
  useActiveOrganization: () => ({ organization: { data: null } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/authClient", () => ({
  default: {
    getSession: () => Promise.resolve({ data: null }),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock("@/lib/clientAuthUtils", () => ({
  getSlugFromHost: () => "doesnotexist",
}));

// Each page is identified by a placeholder its own form renders; signup has no
// `data-testid="page"` wrapper, so a shared testid is not available.
const PAGES = [
  ["login", LoginPage, "Password"],
  ["signup", SignupPage, "John"],
  ["forgotpassword", ForgotPasswordPage, "example@email.com"],
  ["resetpassword", ResetPasswordPage, "Enter a new password"],
] as const;

describe("auth pages for a nonexistent organization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        host: "doesnotexist.lvh.me:3000",
        // resetpassword renders an "expired" view without a token
        search: "?token=test-token",
      },
      writable: true,
    });
  });

  afterEach(cleanup);

  describe.each(PAGES)("%s", (name, Page, formMarker) => {
    it("renders the not-found state instead of the form", () => {
      mockConfig.mockReturnValue({ status: "not-found" });

      render(<Page />);

      const notFound = screen.getByTestId("organization-not-found");
      // The host is rendered in its own span, so the copy spans text nodes.
      expect(notFound.textContent).toContain(
        "no nonprofit at doesnotexist.lvh.me:3000",
      );
      // The dead end this fixes: no form for a visitor to keep guessing at.
      expect(screen.queryByPlaceholderText(formMarker)).toBeNull();
    });

    it("renders normally when the organization exists", () => {
      mockConfig.mockReturnValue({
        status: "ok",
        primary_color: "#FD8033",
        secondary_color: "#FB3552",
      });

      render(<Page />);

      expect(screen.queryByTestId("organization-not-found")).toBeNull();
      expect(screen.getByPlaceholderText(formMarker)).toBeTruthy();
    });

    // A server error or dropped connection must never claim the nonprofit
    // does not exist -- that is how a visitor gets told to stop trying.
    it("renders normally when the config request errored", () => {
      mockConfig.mockReturnValue({ status: "error" });

      render(<Page />);

      expect(screen.queryByTestId("organization-not-found")).toBeNull();
      expect(screen.getByPlaceholderText(formMarker)).toBeTruthy();
    });
  });
});
