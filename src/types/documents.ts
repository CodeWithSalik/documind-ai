export type DocumentStatus = "PENDING" | "PROCESSING" | "READY" | "ERROR";

export type SupportedMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "text/csv"
  | "text/plain"
  | "text/markdown"
  | "text/html"
  | "application/json"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export interface DocumentMetadata {
  author?: string;
  title?: string;
  subject?: string;
  createdDate?: string;
  modifiedDate?: string;
  pageCount?: number;
  wordCount?: number;
  sheets?: string[];
  encoding?: string;
  [key: string]: unknown;
}

export interface DocumentChunkData {
  id: string;
  documentId: string;
  index: number;
  content: string;
  pageNumber?: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentData {
  id: string;
  name: string;
  mimeType: SupportedMimeType;
  sizeBytes: number;
  storageKey: string;
  status: DocumentStatus;
  pageCount?: number;
  wordCount?: number;
  metadata?: DocumentMetadata;
  errorMessage?: string;
  workspaceId: string;
  folderId?: string;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  wordCount: number;
  metadata: DocumentMetadata;
  pages?: Array<{ pageNumber: number; content: string }>;
}

export interface DocumentExtractor {
  supportedMimeTypes: string[];
  extract(buffer: Buffer, mimeType: string): Promise<ExtractionResult>;
}

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
  strategy?: "heading" | "paragraph" | "table" | "single";
}

export interface ProcessingJob {
  documentId: string;
  storageKey: string;
  mimeType: string;
  workspaceId: string;
}

export const SUPPORTED_MIME_TYPES: SupportedMimeType[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/html",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export const MIME_TYPE_LABELS: Record<SupportedMimeType, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel Spreadsheet",
  "text/csv": "CSV",
  "text/plain": "Plain Text",
  "text/markdown": "Markdown",
  "text/html": "HTML",
  "application/json": "JSON",
  "image/png": "PNG Image",
  "image/jpeg": "JPEG Image",
  "image/webp": "WebP Image",
};

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
