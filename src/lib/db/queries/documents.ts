import { db } from "@/lib/db/client";
import type { DocumentStatus, Prisma } from "@prisma/client";

export interface CreateDocumentInput {
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  workspaceId: string;
  uploadedById: string;
  folderId?: string | null;
  pageCount?: number;
  wordCount?: number;
  metadata?: Prisma.InputJsonValue;
}

export interface DocumentChunkInput {
  content: string;
  index: number;
  pageNumber?: number;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateDocumentStatusDetails {
  pageCount?: number;
  wordCount?: number;
  errorMessage?: string | null;
  metadata?: Prisma.InputJsonValue;
  processedAt?: Date;
}

/**
 * Retrieves all documents for a given workspace, optionally filtered by folder.
 */
export async function getWorkspaceDocuments(workspaceId: string, folderId?: string) {
  return db.document.findMany({
    where: {
      workspaceId,
      ...(folderId !== undefined ? { folderId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          chunks: true,
        },
      },
    },
  });
}

/**
 * Retrieves a single document by ID within a workspace, including its chunks and uploader info.
 */
export async function getDocumentById(id: string, workspaceId: string) {
  return db.document.findFirst({
    where: {
      id,
      workspaceId,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      folder: true,
      chunks: {
        orderBy: { index: "asc" },
      },
    },
  });
}

/**
 * Creates a new document record in PENDING status.
 */
export async function createDocument(data: CreateDocumentInput) {
  return db.document.create({
    data: {
      name: data.name,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      storageKey: data.storageKey,
      workspaceId: data.workspaceId,
      uploadedById: data.uploadedById,
      folderId: data.folderId ?? null,
      pageCount: data.pageCount,
      wordCount: data.wordCount,
      metadata: data.metadata,
      status: "PENDING",
    },
  });
}

/**
 * Updates the processing status and optional metadata/error of a document.
 */
export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  details?: UpdateDocumentStatusDetails
) {
  return db.document.update({
    where: { id },
    data: {
      status,
      pageCount: details?.pageCount,
      wordCount: details?.wordCount,
      errorMessage: details?.errorMessage,
      metadata: details?.metadata,
      processedAt:
        details?.processedAt ?? (status === "READY" ? new Date() : undefined),
    },
  });
}

/**
 * Replaces or saves document chunks in an indexed order.
 */
export async function saveDocumentChunks(
  documentId: string,
  chunks: DocumentChunkInput[]
) {
  return db.$transaction(async (tx) => {
    // Delete existing chunks if re-processing to maintain idempotency
    await tx.documentChunk.deleteMany({
      where: { documentId },
    });

    if (chunks.length === 0) {
      return { count: 0 };
    }

    return tx.documentChunk.createMany({
      data: chunks.map((chunk) => ({
        documentId,
        index: chunk.index,
        content: chunk.content,
        pageNumber: chunk.pageNumber ?? null,
        metadata: chunk.metadata ?? undefined,
      })),
    });
  });
}

/**
 * Deletes a document if it belongs to the given workspace.
 */
export async function deleteDocument(id: string, workspaceId: string) {
  const document = await db.document.findFirst({
    where: { id, workspaceId },
  });

  if (!document) {
    return null;
  }

  return db.document.delete({
    where: { id },
  });
}
