import type { TokenUsage, AIToolCall } from "./ai";
import type { DocumentData, DocumentChunkData } from "./documents";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageData {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  model?: string;
  tokenCount?: number;
  metadata?: MessageMetadata;
  createdAt: Date;
}

export interface MessageMetadata {
  toolCalls?: AIToolCall[];
  citations?: Citation[];
  tokenUsage?: TokenUsage;
  processingTimeMs?: number;
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber?: number;
  snippet: string;
}

export interface ConversationData {
  id: string;
  title?: string;
  model: string;
  workspaceId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount?: number;
  lastMessage?: MessageData;
  documents?: DocumentData[];
}

export interface ChatContext {
  conversationId?: string;
  documentIds: string[];
  chunks: DocumentChunkData[];
}

export interface StreamingState {
  isStreaming: boolean;
  content: string;
  error?: string;
}
