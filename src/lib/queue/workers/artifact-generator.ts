import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { ArtifactType, Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { redis } from "@/lib/queue/client";
import { s3, BUCKET_NAME } from "@/lib/storage/client";
import { convertFromMarkdown, createCsv, type ConversionResult } from "@/lib/documents/converter";
import { generateArtifactStorageKey, sanitizeFilename } from "@/lib/utils/files";
import type { ArtifactGenerationJobData } from "@/lib/queue/queues";

export const ARTIFACT_GENERATION_QUEUE_NAME = "artifact-generation";

export interface SheetData {
  name?: string;
  headers?: string[];
  rows?: string[][];
}

export interface ExtendedArtifactGenerationJobData extends Partial<ArtifactGenerationJobData> {
  title: string;
  format: string;
  messageId: string;
  workspaceId: string;
  content?: string;
  sheets?: SheetData[] | SheetData | Record<string, string[][]>;
  type?: "document" | "spreadsheet";
  metadata?: Record<string, unknown>;
}

/**
 * Converts provided content or sheet data into the target file format buffer and MIME type.
 */
function convertContentToTargetFormat(
  content: string,
  format: string,
  sheets?: SheetData[] | SheetData | Record<string, string[][]>,
): Promise<ConversionResult> | ConversionResult {
  const normalizedFormat = format.trim().toLowerCase();

  // 1. CSV Format Handling
  if (normalizedFormat === "csv") {
    // Check if sheets array was passed
    if (Array.isArray(sheets) && sheets.length > 0 && sheets[0].headers && sheets[0].rows) {
      return createCsv(sheets[0].headers, sheets[0].rows);
    }

    // Check if single sheet object was passed
    if (sheets && typeof sheets === "object" && !Array.isArray(sheets)) {
      if ("headers" in sheets && "rows" in sheets && Array.isArray((sheets as SheetData).headers)) {
        const sheet = sheets as SheetData;
        return createCsv(sheet.headers ?? [], sheet.rows ?? []);
      }
    }

    // Try parsing content as JSON containing headers & rows
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.headers && Array.isArray(parsed.headers) && parsed.rows && Array.isArray(parsed.rows)) {
          return createCsv(parsed.headers, parsed.rows);
        }
      } catch {
        // Not JSON, treat as raw CSV text
      }

      return {
        buffer: Buffer.from(content, "utf-8"),
        mimeType: "text/csv",
        extension: ".csv",
      };
    }

    return createCsv([], []);
  }

  // 2. HTML Format Handling
  if (normalizedFormat === "html" || normalizedFormat === "htm") {
    return convertFromMarkdown(content, "html");
  }

  // 3. Markdown Format Handling (Default)
  if (normalizedFormat === "markdown" || normalizedFormat === "md") {
    return {
      buffer: Buffer.from(content, "utf-8"),
      mimeType: "text/markdown",
      extension: ".md",
    };
  }

  // Fallback for plain text, JSON, or other text types
  if (normalizedFormat === "json") {
    return {
      buffer: Buffer.from(content, "utf-8"),
      mimeType: "application/json",
      extension: ".json",
    };
  }

  return {
    buffer: Buffer.from(content, "utf-8"),
    mimeType: "text/plain",
    extension: `.${normalizedFormat || "txt"}`,
  };
}

/**
 * Determines the database ArtifactType enum based on format and job type.
 */
function resolveArtifactType(format: string, type?: string): ArtifactType {
  const normFormat = format.trim().toLowerCase();

  if (type === "spreadsheet" || normFormat === "csv" || normFormat === "xlsx") {
    return "SPREADSHEET";
  }

  if (normFormat === "markdown" || normFormat === "md") {
    return "MARKDOWN";
  }

  if (normFormat === "html" || normFormat === "htm" || type === "document") {
    return "DOCUMENT";
  }

  if (normFormat === "json" || normFormat === "js" || normFormat === "ts" || normFormat === "py") {
    return "CODE";
  }

  return "OTHER";
}

/**
 * Job processing function for artifact generation.
 *
 * 1. Takes title, content/sheets, format, messageId, workspaceId
 * 2. Converts content to the desired format (Markdown, HTML, CSV)
 * 3. Uploads generated artifact to S3
 * 4. Creates Artifact record in database linked to messageId
 */
export async function processArtifactGenerationJob(
  job: Job<ExtendedArtifactGenerationJobData>,
): Promise<{ success: boolean; artifactId: string; storageKey: string }> {
  const {
    title,
    content = "",
    sheets,
    format,
    messageId,
    workspaceId,
    type,
    metadata,
  } = job.data;

  if (!title) {
    throw new Error("Artifact generation job requires a title.");
  }
  if (!messageId) {
    throw new Error("Artifact generation job requires a valid messageId.");
  }
  if (!workspaceId) {
    throw new Error("Artifact generation job requires a workspaceId.");
  }

  // Verify that target message exists
  const message = await db.message.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new Error(`Referenced message ${messageId} does not exist in the database.`);
  }

  // 2. Converts content to the desired format (Markdown, HTML, CSV)
  const conversionResult = await convertContentToTargetFormat(content, format, sheets);

  // 3. Uploads generated artifact to S3
  const artifactId = randomUUID();
  const sanitizedTitle = sanitizeFilename(title);
  const ext = conversionResult.extension.startsWith(".")
    ? conversionResult.extension
    : `.${conversionResult.extension}`;
  const fileName = sanitizedTitle.toLowerCase().endsWith(ext.toLowerCase())
    ? sanitizedTitle
    : `${sanitizedTitle}${ext}`;

  const storageKey = generateArtifactStorageKey(workspaceId, artifactId, fileName);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      Body: conversionResult.buffer,
      ContentType: conversionResult.mimeType,
      ContentLength: conversionResult.buffer.length,
    }),
  );

  // 4. Creates Artifact record in database linked to messageId
  const artifactType = resolveArtifactType(format, type);

  await db.artifact.create({
    data: {
      id: artifactId,
      name: fileName,
      type: artifactType,
      mimeType: conversionResult.mimeType,
      sizeBytes: conversionResult.buffer.length,
      storageKey,
      messageId,
      metadata: {
        format,
        title,
        workspaceId,
        ...(metadata ?? {}),
      } as Prisma.InputJsonValue,
    },
  });

  return {
    success: true,
    artifactId,
    storageKey,
  };
}

/**
 * Creates and configures the BullMQ worker for the artifact-generation queue.
 */
export function createArtifactGeneratorWorker(
  connection = redis,
): Worker<ExtendedArtifactGenerationJobData> {
  return new Worker<ExtendedArtifactGenerationJobData>(
    ARTIFACT_GENERATION_QUEUE_NAME,
    processArtifactGenerationJob,
    {
      connection,
      concurrency: 5,
    },
  );
}
