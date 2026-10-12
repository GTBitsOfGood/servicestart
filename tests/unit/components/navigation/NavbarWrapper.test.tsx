import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import NavbarWrapper from "@/components/navigation/NavbarWrapper";

const pathname = vi.hoisted(() => ({ current: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

function renderAt(path: string) {
  pathname.current = path;
  render(
    <NavbarWrapper noNavbarChildren={<p>without navbar</p>}>
      <p>with navbar</p>
    </NavbarWrapper>,
  );
}

describe("NavbarWrapper", () => {
  afterEach(cleanup);

  it("renders the navbar layout on regular pages", () => {
    renderAt("/events");
    expect(screen.getByText("with navbar")).toBeTruthy();
  });

  it("renders without the navbar on excluded pages", () => {
    renderAt("/login");
    expect(screen.getByText("without navbar")).toBeTruthy();
  });

  it("renders without the navbar under a prefix entry", () => {
    renderAt("/forms/camp-application-2027");
    expect(screen.getByText("without navbar")).toBeTruthy();
  });

  it("renders the navbar on a path that only shares the prefix's letters", () => {
    renderAt("/formsabc");
    expect(screen.getByText("with navbar")).toBeTruthy();
  });
});
