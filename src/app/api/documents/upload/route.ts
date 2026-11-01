import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/guards";
import { uploadRequestSchema } from "@/lib/validators/documents";
import { generateStorageKey, validateFileBuffer } from "@/lib/utils/files";
import { getPresignedUploadUrl } from "@/lib/storage/presigned";
import { saveFile } from "@/lib/storage/operations";
import { processDocument } from "@/lib/documents/processor";
import { chunkText } from "@/lib/documents/chunker";
import { saveDocumentChunks, updateDocumentStatus } from "@/lib/db/queries/documents";
import { MAX_FILE_SIZE_BYTES, SUPPORTED_MIME_TYPES, type SupportedMimeType } from "@/types/documents";
import {
  AppError,
  DocumentProcessingError,
  NotFoundError,
  ValidationError,
  formatErrorResponse,
  toAppError,
} from "@/lib/utils/errors";
import type { Prisma } from "@prisma/client";

function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((i) => i.message).join(", ");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: issues || "Invalid upload parameters",
          details: error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(formatErrorResponse(error), { status: error.statusCode });
  }

  const appErr = toAppError(error);
  return NextResponse.json(formatErrorResponse(appErr), { status: appErr.statusCode });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const contentType = req.headers.get("content-type") || "";

    // 1. Direct Multipart Form Data Upload
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const workspaceId = (formData.get("workspaceId") as string) || "default-workspace";
      const folderId = (formData.get("folderId") as string) || null;

      if (!file) {
        throw new ValidationError("No file provided in form data");
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new ValidationError(`File exceeds maximum size limit of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
      }

      // Check supported MIME or extension fallback
      const ext = file.name.split(".").pop()?.toLowerCase();
      const isExtSupported = ext && ["pdf", "docx", "xlsx", "csv", "txt", "md", "html", "json", "png", "jpg", "jpeg", "webp"].includes(ext);
      const isMimeSupported = SUPPORTED_MIME_TYPES.includes(file.type as SupportedMimeType);

      if (!isMimeSupported && !isExtSupported) {
        throw new ValidationError(`Unsupported file type: ${file.type || ext}`);
      }

      const { workspace } = await requireWorkspaceAccess(workspaceId, "MEMBER");
      const activeWorkspaceId = workspace ? workspace.id : workspaceId;

      if (folderId) {
        const folder = await db.folder.findFirst({
          where: { id: folderId, workspaceId: activeWorkspaceId },
        });
        if (!folder) {
          throw new NotFoundError("Folder", folderId);
        }
      }

      const documentId = randomUUID();
      const storageKey = generateStorageKey(activeWorkspaceId, documentId, file.name);

      // Read buffer and inspect magic bytes to reject executables and malformed files
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const validation = validateFileBuffer(buffer, file.name, file.type);
      if (!validation.isValid) {
        throw new ValidationError(validation.error || "Invalid file content or corrupted file header");
      }
      const verifiedMimeType = validation.detectedMime || file.type || "application/octet-stream";

      await saveFile(storageKey, buffer, verifiedMimeType);

      // Persist Document in PENDING status
      await db.document.create({
        data: {
          id: documentId,
          name: file.name,
          mimeType: verifiedMimeType,
          sizeBytes: file.size,
          storageKey,
          workspaceId: activeWorkspaceId,
          uploadedById: user.id,
          folderId,
          status: "PENDING",
        },
      });

      // Synchronously process document and save chunks
      try {
        const extraction = await processDocument(buffer, verifiedMimeType, file.name);
        const chunks = chunkText(extraction.text, {}, extraction.pages);

        await saveDocumentChunks(
          documentId,
          chunks.map((c) => ({
            index: c.index,
            content: c.content,
            pageNumber: c.pageNumber,
            metadata: { tokenCount: c.tokenCount },
          }))
        );

        const updatedDoc = await updateDocumentStatus(documentId, "READY", {
          pageCount: extraction.pageCount,
          wordCount: extraction.wordCount,
          metadata: extraction.metadata as Prisma.InputJsonValue,
          processedAt: new Date(),
        });

        return NextResponse.json({
          success: true,
          data: {
            document: updatedDoc,
            documentId: updatedDoc.id,
            status: "READY",
            pageCount: extraction.pageCount,
            wordCount: extraction.wordCount,
            chunkCount: chunks.length,
          },
        });
      } catch (processingErr) {
        const errorMessage =
          processingErr instanceof Error
            ? processingErr.message
            : "Document processing failed";

        const errorCode =
          processingErr instanceof DocumentProcessingError
            ? processingErr.documentErrorCode
            : "PROCESSING_ERROR";

        const statusCode =
          processingErr instanceof AppError
            ? processingErr.statusCode
            : 422;

        await updateDocumentStatus(documentId, "ERROR", {
          errorMessage,
        });

        return NextResponse.json(
          {
            success: false,
            error: {
              code: errorCode,
              message: errorMessage,
            },
            data: {
              documentId,
              status: "ERROR",
              errorMessage,
            },
          },
          { status: statusCode }
        );
      }
    }

    // 2. JSON Request for Presigned Upload URL
    const json = await req.json();
    const body = uploadRequestSchema.parse(json);
    const fileName = body.fileName || body.name || "document";

    const { workspace } = await requireWorkspaceAccess(body.workspaceId, "MEMBER");
    const activeWorkspaceId = workspace ? workspace.id : body.workspaceId;

    if (body.folderId) {
      const folder = await db.folder.findFirst({
        where: { id: body.folderId, workspaceId: activeWorkspaceId },
      });
      if (!folder) {
        throw new NotFoundError("Folder", body.folderId);
      }
    }

    const documentId = randomUUID();
    const storageKey = generateStorageKey(activeWorkspaceId, documentId, fileName);

    // Persist document in PENDING state so future process route calls find it
    await db.document.create({
      data: {
        id: documentId,
        name: fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        storageKey,
        workspaceId: activeWorkspaceId,
        uploadedById: user.id,
        folderId: body.folderId ?? null,
        status: "PENDING",
      },
    });

    const { url: uploadUrl, expiresAt } = await getPresignedUploadUrl(
      storageKey,
      body.mimeType,
      body.sizeBytes,
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      storageKey,
      documentId,
      data: {
        uploadUrl,
        storageKey,
        documentId,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
