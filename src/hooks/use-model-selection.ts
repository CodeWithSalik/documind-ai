"use client";

import { useSyncExternalStore, useCallback } from "react";
import { DEFAULT_MODEL_ID, type ModelId, MODEL_REGISTRY } from "@/lib/ai/models";

const STORAGE_KEY = "documind-model";
const modelListeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  modelListeners.add(onStoreChange);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    modelListeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function getSnapshot(): ModelId {
  if (typeof window === "undefined") return DEFAULT_MODEL_ID;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in MODEL_REGISTRY) {
      return saved as ModelId;
    }
  } catch {
    // LocalStorage access may fail in restricted/private browsing modes
  }
  return DEFAULT_MODEL_ID;
}

function getServerSnapshot(): ModelId {
  return DEFAULT_MODEL_ID;
}

/**
 * Hook for managing AI model selection with localStorage persistence.
 * Uses useSyncExternalStore for hydration safety (deterministic server snapshot)
 * and tear-free synchronization across all workspace components.
 */
export function useModelSelection() {
  const modelId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setModelId = useCallback((id: ModelId) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignore localStorage write failures
    }
    modelListeners.forEach((listener) => listener());
  }, []);

  const model = MODEL_REGISTRY[modelId] || MODEL_REGISTRY[DEFAULT_MODEL_ID];

  return {
    modelId,
    model,
    setModelId,
    isGemini: true,
    isPremium: model.tier === "premium",
  };
}
