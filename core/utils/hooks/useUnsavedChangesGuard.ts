"use client";

import { useEffect, useRef } from "react";

/**
 * While `dirty`, asks before leaving the page: reloads and closing the tab
 * (`beforeunload`), in-app links, which navigate without `beforeunload`, and
 * the browser's back button.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string) {
  const messageRef = useRef(message);
  const dirtyRef = useRef(dirty);
  // Whether this page has added its extra history entry (see below).
  const guardEntry = useRef(false);
  // Set while the hook itself goes back, so that popstate is ignored.
  const skipPop = useRef(false);

  useEffect(() => {
    messageRef.current = message;
    dirtyRef.current = dirty;
  }, [message, dirty]);

  // Back with unsaved changes first lands on an extra copy of this page's
  // history entry, which is restored if the admin chooses to stay. There's at
  // most one, and it's removed once nothing is unsaved, so Back still leaves
  // the page in one step.
  useEffect(() => {
    const onPopState = () => {
      if (skipPop.current) {
        skipPop.current = false;
        return;
      }
      if (!guardEntry.current) return;
      if (dirtyRef.current && !window.confirm(messageRef.current)) {
        window.history.pushState(
          window.history.state,
          "",
          window.location.href,
        );
        return;
      }
      guardEntry.current = false;
      window.history.back();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (dirty && !guardEntry.current) {
      window.history.pushState(window.history.state, "", window.location.href);
      guardEntry.current = true;
    } else if (!dirty && guardEntry.current) {
      guardEntry.current = false;
      skipPop.current = true;
      window.history.back();
    }
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();

    // Runs before Next.js's Link handler, so cancelling stops the navigation.
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      if (!window.confirm(messageRef.current)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
