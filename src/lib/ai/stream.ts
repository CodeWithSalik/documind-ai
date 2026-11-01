import { streamText } from "ai";
import { getModel, getFallbackModelId } from "./providers";
import { buildContextPrompt } from "./prompts";
import { workspaceTools } from "./tools";
import type { DocumentChunkData } from "@/types/documents";

export interface ChatStreamOptions {
  modelId: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  documentChunks?: DocumentChunkData[];
  documentNames?: Map<string, string>;
  noEvidenceFound?: boolean;
  unreadyDocumentNotice?: string;
  enableTools?: boolean;
  temperature?: number;
  maxTokens?: number;
  onError?: (error: Error) => void;
}

/**
 * Creates a streaming chat response with automatic provider fallback.
 */
export async function createChatStream(options: ChatStreamOptions) {
  const {
    modelId,
    messages,
    documentChunks = [],
    documentNames = new Map(),
    noEvidenceFound = false,
    unreadyDocumentNotice,
    enableTools = true,
    temperature = 0.7,
    maxTokens,
    onError,
  } = options;

  const systemPrompt = buildContextPrompt(documentChunks, documentNames, {
    noEvidenceFound,
    unreadyDocumentNotice,
  });

  try {
    const model = getModel(modelId);

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: enableTools ? workspaceTools : undefined,
      temperature,
      maxOutputTokens: maxTokens,
      maxRetries: 0,
    });

    return result;
  } catch (error) {
    // Attempt fallback to alternate provider
    const fallbackId = getFallbackModelId(modelId);
    if (fallbackId) {
      console.warn(
        `Primary model ${modelId} failed, falling back to ${fallbackId}:`,
        error,
      );
      const fallbackModel = getModel(fallbackId);

      return streamText({
        model: fallbackModel,
        system: systemPrompt,
        messages,
        tools: enableTools ? workspaceTools : undefined,
        temperature,
        maxOutputTokens: maxTokens,
        maxRetries: 0,
      });
    }

    // No fallback available
    if (onError && error instanceof Error) {
      onError(error);
    }
    throw error;
  }
}
