export type AIProvider = "google" | "custom";

export type ModelTier = "standard" | "premium";

export interface ModelDefinition {
  id: string;
  provider: AIProvider;
  apiModelId: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsToolCalls: boolean;
  tier: ModelTier;
}

export interface ModelCapabilities {
  supportsVision: boolean;
  supportsToolCalls: boolean;
  contextWindow: number;
  maxOutputTokens: number;
}

export interface AIRequestOptions {
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface ProviderStatus {
  provider: AIProvider;
  available: boolean;
  lastChecked: Date;
  errorMessage?: string;
}
