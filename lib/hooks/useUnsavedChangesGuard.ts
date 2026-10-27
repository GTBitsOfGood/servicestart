"use client";

import { useEffect, useRef } from "react";

/**
 * While `dirty`, asks before leaving the page: reloads and closing the tab
 * (`beforeunload`), in-app links, which navigate without `beforeunload`, and
 * the browser's back button.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string) {
  const messageRef = useRef(message);
  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    if (!dirty) return;
    const confirmLeave = () => window.confirm(messageRef.current);

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
      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // An extra history entry on this page, so Back first lands here and can
    // be undone if the admin chooses to stay.
    window.history.pushState(window.history.state, "", window.location.href);
    let leaving = false;
    const onPopState = () => {
      if (leaving) return;
      if (confirmLeave()) {
        leaving = true;
        window.history.back();
      } else {
        window.history.pushState(
          window.history.state,
          "",
          window.location.href,
        );
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);
}
