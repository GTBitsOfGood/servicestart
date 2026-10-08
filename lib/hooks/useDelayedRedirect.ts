"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Schedules `router.push` after a delay; clears pending navigation on unmount. */
export function useDelayedRedirect() {
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((path: string, delayMs: number) => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => router.push(path), delayMs);
  }, [router]);
}
