import type { ModelDefinition, AIProvider } from "@/types/ai";

export const MODEL_REGISTRY = {
  "gemini-1.5-flash": {
    id: "gemini-1.5-flash",
    provider: "google" as AIProvider,
    apiModelId: "gemini-3.5-flash",
    displayName: "Gemini 1.5 Flash",
    description: "Fast, efficient reasoning model with 1M context window",
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsToolCalls: true,
    tier: "standard" as const,
  },
  "gemini-1.5-pro": {
    id: "gemini-1.5-pro",
    provider: "google" as AIProvider,
    apiModelId: "gemini-3.5-flash",
    displayName: "Gemini 1.5 Pro",
    description: "Deep reasoning & multi-document synthesis with 2M context window",
    contextWindow: 2_097_152,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsToolCalls: true,
    tier: "premium" as const,
  },
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    provider: "google" as AIProvider,
    apiModelId: "gemini-3-flash-preview",
    displayName: "Gemini 2.0 Flash",
    description: "Next-generation multimodal model with ultra-low latency",
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    supportsVision: true,
    supportsToolCalls: true,
    tier: "standard" as const,
  },
} as const satisfies Record<string, ModelDefinition>;

export type ModelId = keyof typeof MODEL_REGISTRY;

export const DEFAULT_MODEL_ID: ModelId = "gemini-1.5-flash";
export const MODEL_IDS = Object.keys(MODEL_REGISTRY) as ModelId[];

export function getModelDefinition(modelId: string): ModelDefinition {
  if (modelId in MODEL_REGISTRY) {
    return MODEL_REGISTRY[modelId as ModelId];
  }
  // Support legacy and alias model identifiers gracefully
  if (modelId === "gemini-2.5-flash") return MODEL_REGISTRY["gemini-1.5-flash"];
  if (modelId === "gemini-2.5-pro") return MODEL_REGISTRY["gemini-1.5-pro"];

  throw new Error(`Unknown model: ${modelId}`);
}

export function getModelsByProvider(provider: AIProvider): ModelDefinition[] {
  return MODEL_IDS
    .map((id) => MODEL_REGISTRY[id])
    .filter((m) => m.provider === provider);
}

export function getModelsByTier(tier: "standard" | "premium"): ModelDefinition[] {
  return MODEL_IDS
    .map((id) => MODEL_REGISTRY[id])
    .filter((m) => m.tier === tier);
}
