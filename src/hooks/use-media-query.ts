"use client";

import { useSyncExternalStore } from "react";

/**
 * React hook that tracks whether a CSS media query matches.
 * Uses useSyncExternalStore for tear-free external store subscription.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false),
    () => false
  );
}

// Convenience hooks for common breakpoints
export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}

export function useIsTablet(): boolean {
  const isAboveMobile = useMediaQuery("(min-width: 768px)");
  const isBelowDesktop = !useMediaQuery("(min-width: 1024px)");
  return isAboveMobile && isBelowDesktop;
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
