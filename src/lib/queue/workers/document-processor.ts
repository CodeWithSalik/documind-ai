import { Worker, type Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { redis } from "@/lib/queue/client";
import { downloadFile } from "@/lib/storage/operations";
import { processDocument } from "@/lib/documents/processor";
import { chunkText, type TextChunk } from "@/lib/documents/chunker";
import type { DocumentProcessingJobData } from "@/lib/queue/queues";

export const DOCUMENT_PROCESSING_QUEUE_NAME = "document-processing";

/**
 * Persists document text chunks to the database.
 * Removes any pre-existing chunks for idempotency.
 */
export async function saveDocumentChunks(
  documentId: string,
  chunks: TextChunk[],
): Promise<void> {
  // Clear any existing chunks for this document
  await db.documentChunk.deleteMany({
    where: { documentId },
  });

  if (chunks.length === 0) {
    return;
  }

  // Create document chunk records in batch
  await db.documentChunk.createMany({
    data: chunks.map((chunk) => ({
      documentId,
      index: chunk.index,
      content: chunk.content,
      pageNumber: chunk.pageNumber ?? null,
      metadata: {
        tokenCount: chunk.tokenCount,
      },
    })),
  });
}

/**
 * Job processing function for document extraction and chunking.
 *
 * 1. Downloads file buffer from S3 via downloadFile(storageKey)
 * 2. Updates document status in DB to PROCESSING
 * 3. Calls processDocument(buffer, mimeType, fileName)
 * 4. Chunks text using chunkText(text, ...)
 * 5. Saves chunks in DB using saveDocumentChunks
 * 6. Updates document metadata, pageCount, wordCount, status to READY
 * 7. Handles errors by setting status to ERROR and recording errorMessage
 */
export async function processDocumentJob(
  job: Job<DocumentProcessingJobData>,
): Promise<{ success: boolean; documentId: string; chunkCount: number }> {
  const { documentId, storageKey, mimeType } = job.data;

  // 2. Update document status in DB to PROCESSING
  await db.document.update({
    where: { id: documentId },
    data: {
      status: "PROCESSING",
      errorMessage: null,
    },
  });

  try {
    // Retrieve document details for filename
    const document = await db.document.findUnique({
      where: { id: documentId },
      select: { name: true },
    });

    const fileName = document?.name ?? "unknown-document";

    // 1. Download file buffer from S3
    const buffer = await downloadFile(storageKey);

    // 3. Extract text and metadata from document buffer
    const extraction = await processDocument(buffer, mimeType, fileName);

    // 4. Chunk text into AI context-friendly pieces
    const chunks = chunkText(extraction.text, {}, extraction.pages);

    // 5. Save chunks to database
    await saveDocumentChunks(documentId, chunks);

    // 6. Update document metadata, pageCount, wordCount, status to READY
    await db.document.update({
      where: { id: documentId },
      data: {
        status: "READY",
        pageCount: extraction.pageCount ?? null,
        wordCount: extraction.wordCount ?? null,
        metadata: extraction.metadata as Prisma.InputJsonValue,
        processedAt: new Date(),
        errorMessage: null,
      },
    });

    return {
      success: true,
      documentId,
      chunkCount: chunks.length,
    };
  } catch (error: unknown) {
    // 7. Handle errors by setting status to ERROR and recording errorMessage
    const errorMessage =
      error instanceof Error ? error.message : "Document processing failed with an unknown error";

    console.error(`[DocumentProcessor] Error processing document ${documentId}:`, error);

    try {
      await db.document.update({
        where: { id: documentId },
        data: {
          status: "ERROR",
          errorMessage,
        },
      });
    } catch (dbError) {
      console.error(
        `[DocumentProcessor] Failed to update ERROR status for document ${documentId}:`,
        dbError,
      );
    }

    throw error;
  }
}

/**
 * Creates and configures the BullMQ worker for the document-processing queue.
 */
export function createDocumentProcessorWorker(connection = redis): Worker<DocumentProcessingJobData> {
  return new Worker<DocumentProcessingJobData>(
    DOCUMENT_PROCESSING_QUEUE_NAME,
    processDocumentJob,
    {
      connection,
      concurrency: 5,
    },
  );
}
