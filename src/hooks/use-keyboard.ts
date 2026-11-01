"use client";

import { useEffect, useCallback } from "react";

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
};

type ShortcutHandler = () => void;

/**
 * React hook for registering keyboard shortcuts.
 * Supports modifier keys (Ctrl/Cmd, Shift, Alt).
 */
export function useKeyboardShortcut(
  combo: KeyCombo,
  handler: ShortcutHandler,
  enabled = true,
): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (event.key !== "Escape") return;
      }

      const matchesKey = event.key.toLowerCase() === combo.key.toLowerCase();
      const matchesCtrl = combo.ctrl ? event.ctrlKey || event.metaKey : true;
      const matchesMeta = combo.meta ? event.metaKey : true;
      const matchesShift = combo.shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = combo.alt ? event.altKey : !event.altKey;

      if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
        event.preventDefault();
        handler();
      }
    },
    [combo, handler, enabled],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
