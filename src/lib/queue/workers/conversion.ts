import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { ArtifactType, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { redis } from "@/lib/queue/client";
import { s3, BUCKET_NAME } from "@/lib/storage/client";
import { downloadFile } from "@/lib/storage/operations";
import { processDocument } from "@/lib/documents/processor";
import {
  convertFromMarkdown,
  createCsv,
  type ConvertibleFormat,
  type ConversionResult,
} from "@/lib/documents/converter";
import { generateArtifactStorageKey, sanitizeFilename } from "@/lib/utils/files";
import type { ConversionJobData } from "@/lib/queue/queues";

export const CONVERSION_QUEUE_NAME = "document-conversion";

export interface ExtendedConversionJobData extends ConversionJobData {
  messageId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Resolves the database ArtifactType enum for a target conversion format.
 */
function resolveArtifactType(format: string): ArtifactType {
  const norm = format.trim().toLowerCase();
  if (norm === "csv" || norm === "xlsx") return "SPREADSHEET";
  if (norm === "markdown" || norm === "md") return "MARKDOWN";
  if (norm === "html" || norm === "htm" || norm === "pdf" || norm === "docx") return "DOCUMENT";
  if (norm === "json") return "CODE";
  return "OTHER";
}

/**
 * Converts text/markdown content to target format.
 */
async function convertContent(
  textContent: string,
  targetFormat: string,
): Promise<ConversionResult> {
  const norm = targetFormat.trim().toLowerCase();

  if (norm === "markdown" || norm === "md") {
    return {
      buffer: Buffer.from(textContent, "utf-8"),
      mimeType: "text/markdown",
      extension: ".md",
    };
  }

  if (norm === "html" || norm === "htm") {
    return convertFromMarkdown(textContent, "html");
  }

  if (norm === "csv") {
    const lines = textContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Check for markdown table format (| col1 | col2 |)
    const tableLines = lines.filter((line) => line.startsWith("|") && line.endsWith("|"));
    if (tableLines.length >= 2) {
      const dataRows = tableLines
        .filter((line) => !/^\|?\s*[-:]+[-| :]*\|?$/.test(line))
        .map((line) =>
          line
            .split("|")
            .map((c) => c.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1),
        );

      if (dataRows.length > 0) {
        const headers = dataRows[0];
        const rows = dataRows.slice(1);
        return createCsv(headers, rows);
      }
    }

    // Default CSV conversion: single "Content" column with text rows
    return createCsv(
      ["Content"],
      lines.map((l) => [l]),
    );
  }

  if (norm === "json") {
    const jsonStr = JSON.stringify({ content: textContent }, null, 2);
    return {
      buffer: Buffer.from(jsonStr, "utf-8"),
      mimeType: "application/json",
      extension: ".json",
    };
  }

  // Plain text fallback
  return {
    buffer: Buffer.from(textContent, "utf-8"),
    mimeType: "text/plain",
    extension: ".txt",
  };
}

/**
 * Ensures a valid Message ID exists to link the converted Artifact record.
 */
async function resolveMessageId(
  documentId: string,
  workspaceId: string,
  uploadedById: string,
  documentName: string,
  targetFormat: string,
  explicitMessageId?: string,
): Promise<string> {
  if (explicitMessageId) {
    const existing = await db.message.findUnique({
      where: { id: explicitMessageId },
    });
    if (existing) {
      return explicitMessageId;
    }
  }

  // Find if document is connected to any conversation
  const convDoc = await db.conversationDocument.findFirst({
    where: { documentId },
    include: {
      conversation: {
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (convDoc?.conversation?.messages?.[0]) {
    return convDoc.conversation.messages[0].id;
  }

  // Find or create a conversation within the workspace
  let conversation = await db.conversation.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        title: `Document Conversions`,
        workspaceId,
        userId: uploadedById,
      },
    });
  }

  // Create a system message referencing the converted document
  const systemMessage = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: "SYSTEM",
      content: `Converted "${documentName}" to ${targetFormat.toUpperCase()}`,
    },
  });

  return systemMessage.id;
}

/**
 * Job processing function for document format conversion.
 *
 * 1. Loads source document and chunks
 * 2. Converts to target format
 * 3. Stores converted file in S3 as a new Artifact
 * 4. Records in DB and marks ready
 */
export async function processConversionJob(
  job: Job<ExtendedConversionJobData>,
): Promise<{ success: boolean; artifactId: string; storageKey: string }> {
  const { documentId, targetFormat, workspaceId, messageId, metadata } = job.data;

  // 1. Loads source document and chunks
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: {
      chunks: {
        orderBy: { index: "asc" },
      },
    },
  });

  if (!document) {
    throw new Error(`Source document ${documentId} not found.`);
  }

  // Aggregate content from chunks or raw storage file
  let textContent = document.chunks.map((c) => c.content).join("\n\n");

  if (!textContent.trim() && document.storageKey) {
    const rawBuffer = await downloadFile(document.storageKey);
    const extraction = await processDocument(rawBuffer, document.mimeType, document.name);
    textContent = extraction.text;
  }

  if (!textContent.trim()) {
    throw new Error(
      `Cannot convert document ${documentId}: no extractable text content available.`,
    );
  }

  // 2. Converts to target format
  const converted = await convertContent(textContent, targetFormat);

  // 3. Stores converted file in S3 as a new Artifact
  const artifactId = randomUUID();
  const baseName = sanitizeFilename(document.name.replace(/\.[^/.]+$/, ""));
  const cleanExt = converted.extension.startsWith(".")
    ? converted.extension
    : `.${converted.extension}`;
  const artifactName = `${baseName}${cleanExt}`;

  const storageKey = generateArtifactStorageKey(workspaceId, artifactId, artifactName);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      Body: converted.buffer,
      ContentType: converted.mimeType,
      ContentLength: converted.buffer.length,
    }),
  );

  // 4. Records in DB and marks ready
  const targetMessageId = await resolveMessageId(
    document.id,
    workspaceId,
    document.uploadedById,
    document.name,
    targetFormat,
    messageId,
  );

  const artifactType = resolveArtifactType(targetFormat);

  await db.artifact.create({
    data: {
      id: artifactId,
      name: artifactName,
      type: artifactType,
      mimeType: converted.mimeType,
      sizeBytes: converted.buffer.length,
      storageKey,
      messageId: targetMessageId,
      metadata: {
        sourceDocumentId: document.id,
        sourceDocumentName: document.name,
        targetFormat,
        status: "READY",
        ...(metadata ?? {}),
      } as Prisma.InputJsonValue,
    },
  });

  // Mark document status as READY
  await db.document.update({
    where: { id: documentId },
    data: {
      status: "READY",
    },
  });

  return {
    success: true,
    artifactId,
    storageKey,
  };
}

/**
 * Creates and configures the BullMQ worker for the document-conversion queue.
 */
export function createConversionWorker(
  connection = redis,
): Worker<ExtendedConversionJobData> {
  return new Worker<ExtendedConversionJobData>(
    CONVERSION_QUEUE_NAME,
    processConversionJob,
    {
      connection,
      concurrency: 5,
    },
  );
}
