export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export interface DocumentUploadRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  workspaceId: string;
  folderId?: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  modelId: string;
  documentIds?: string[];
  workspaceId: string;
}

export interface ConversionRequest {
  documentId: string;
  targetFormat: string;
}

export interface ConversionResponse {
  artifactId: string;
  downloadUrl: string;
  name: string;
  mimeType: string;
}
