import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";

const MESSAGE = "Leave without saving?";

function clickLink(href: string) {
  const link = document.createElement("a");
  link.href = href;
  document.body.append(link);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  link.remove();
  return event;
}

beforeEach(() => {
  vi.spyOn(window.history, "pushState");
  vi.spyOn(window.history, "back").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  it("does nothing while there are no unsaved changes", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderHook(() => useUnsavedChangesGuard(false, MESSAGE));
    expect(clickLink("/members").defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(window.history.pushState).not.toHaveBeenCalled();
  });

  it("asks before following an in-app link", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHook(() => useUnsavedChangesGuard(true, MESSAGE));
    expect(clickLink("/members").defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledWith(MESSAGE);
    confirm.mockReturnValue(true);
    expect(clickLink("/members").defaultPrevented).toBe(false);
  });

  it("ignores links that open elsewhere", () => {
    const confirm = vi.spyOn(window, "confirm");
    renderHook(() => useUnsavedChangesGuard(true, MESSAGE));
    clickLink("https://example.org/");
    clickLink(window.location.href);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps the admin on the page when they cancel Back", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHook(() => useUnsavedChangesGuard(true, MESSAGE));
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new PopStateEvent("popstate"));
    // The extra entry comes back, and the page doesn't go back further.
    expect(window.history.pushState).toHaveBeenCalledTimes(2);
    expect(window.history.back).not.toHaveBeenCalled();
  });

  it("leaves when they confirm Back", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHook(() => useUnsavedChangesGuard(true, MESSAGE));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(window.history.back).toHaveBeenCalledTimes(1);
  });

  it("adds one extra history entry and removes it once changes are saved", () => {
    const { rerender } = renderHook(
      ({ dirty }) => useUnsavedChangesGuard(dirty, MESSAGE),
      { initialProps: { dirty: true } },
    );
    rerender({ dirty: true });
    expect(window.history.pushState).toHaveBeenCalledTimes(1);
    rerender({ dirty: false });
    expect(window.history.back).toHaveBeenCalledTimes(1);
    // The hook's own Back is ignored rather than treated as leaving.
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(window.history.back).toHaveBeenCalledTimes(1);
    // Editing again adds a single new entry, so entries never pile up.
    rerender({ dirty: true });
    expect(window.history.pushState).toHaveBeenCalledTimes(2);
  });
});
