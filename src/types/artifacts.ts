export type ArtifactType =
  | "DOCUMENT"
  | "SPREADSHEET"
  | "CODE"
  | "CHART"
  | "MARKDOWN"
  | "OTHER";

export interface ArtifactData {
  id: string;
  name: string;
  type: ArtifactType;
  mimeType: string;
  sizeBytes?: number;
  storageKey: string;
  messageId: string;
  metadata?: ArtifactMetadata;
  createdAt: Date;
  downloadUrl?: string;
}

export interface ArtifactMetadata {
  generationModel?: string;
  sourceDocumentIds?: string[];
  prompt?: string;
  format?: string;
  [key: string]: unknown;
}

export interface ArtifactGenerationRequest {
  type: ArtifactType;
  name: string;
  content: string;
  format: string;
  messageId: string;
  metadata?: Record<string, unknown>;
}
