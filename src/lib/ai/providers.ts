import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { getModelDefinition, type ModelId } from "./models";
import type { AIProvider, ProviderStatus } from "@/types/ai";

/**
 * Returns a Vercel AI SDK LanguageModel instance for the given model ID.
 * This is the single point of provider resolution — all downstream code
 * uses the returned LanguageModel generically.
 */
export function getModel(modelId: string): LanguageModel {
  const definition = getModelDefinition(modelId);

  switch (definition.provider) {
    case "google":
      return google(definition.apiModelId);
    default: {
      throw new Error(`Unsupported or unconfigured provider: ${definition.provider}`);
    }
  }
}

/**
 * Returns a fallback model ID when the primary provider is unavailable.
 * DocuMind AI operates in zero-budget mode: no silent fallbacks to paid providers.
 * Returns null to prevent unintended paid API charges.
 */
export function getFallbackModelId(_modelId: string): ModelId | null {
  return null;
}

/**
 * Checks whether a provider's API is configured (has required env vars).
 */
export function isProviderConfigured(provider: AIProvider): boolean {
  switch (provider) {
    case "google":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    default:
      return false;
  }
}

/**
 * Returns the configuration status of all active providers.
 */
export function getProviderStatuses(): ProviderStatus[] {
  const providers: AIProvider[] = ["google"];
  return providers.map((provider) => ({
    provider,
    available: isProviderConfigured(provider),
    lastChecked: new Date(),
    errorMessage: isProviderConfigured(provider)
      ? undefined
      : `Missing API key for ${provider}`,
  }));
}
