import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HorizontalNavLayout } from "@/components/navigation/HorizontalNavLayout";

vi.mock("@/components/navigation/HorizontalNav", () => ({
  HorizontalNav: () => (
    <header style={{ padding: "0 24px", columnGap: "16px" }}>
      <div>Logo</div>
      <nav>Admin tabs</nav>
      <div>Notifications and profile</div>
    </header>
  ),
}));

vi.mock("@/components/navigation/MobileSidebarNav", () => ({
  MobileSidebarNav: ({ desktopVisible }: { desktopVisible: boolean }) =>
    desktopVisible ? <button>Open navigation menu</button> : null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("horizontal navigation sizing", () => {
  it("collapses before controls overlap and expands when everything fits again", () => {
    let availableWidth = 1200;
    let profileWidth = 180;
    let onResize = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          onResize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
      function (this: HTMLElement) {
        return this.tagName === "HEADER" ? availableWidth : 0;
      },
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const width =
          this.textContent === "Logo"
            ? 140
            : this.textContent === "Admin tabs"
              ? 650
              : this.textContent === "Notifications and profile"
                ? profileWidth
                : 0;
        return {
          width,
          height: 80,
          top: 0,
          left: 0,
          right: width,
          bottom: 80,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      },
    );

    render(
      <HorizontalNavLayout
        alignment="center"
        mobileNav={{ items: [], drawerSide: "left" }}
      >
        Page content
      </HorizontalNavLayout>,
    );
    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).toBeNull();
    expect(screen.getByRole("navigation").textContent).toBe("Admin tabs");

    // Tabs, logo, controls, padding, and gaps need 1050px in total.
    act(() => {
      availableWidth = 1040;
      onResize();
    });
    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();

    act(() => {
      availableWidth = 1200;
      onResize();
    });
    expect(
      screen.queryByRole("button", { name: "Open navigation menu" }),
    ).toBeNull();
    expect(screen.getByRole("navigation")).toBeTruthy();

    // Loading a longer user name can also exhaust the available space.
    act(() => {
      profileWidth = 400;
      onResize();
    });
    expect(
      screen.getByRole("button", { name: "Open navigation menu" }),
    ).toBeTruthy();
    expect(screen.getByText("Page content")).toBeTruthy();
  });
});
